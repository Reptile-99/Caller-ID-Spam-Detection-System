import { PermissionsAndroid, Platform } from "react-native";
import Contacts from "react-native-contacts";

export interface RawContactItem {
  name: string;
  phone: string;
}

export interface SyncProgressCallback {
  (progress: { processed: number; total: number; percentage: number }): void;
}

const SYNC_API_URL = "https://your-supabase-project.supabase.co/functions/v1/sync-contacts";
const BATCH_CHUNK_SIZE = 100;

export class ContactSyncService {
  /**
   * Request contacts permission with native prompt
   */
  static async requestContactsPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: "Caller ID Contact Verification",
          message: "Allow access to identify incoming unknown callers and protect against spam.",
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else if (Platform.OS === "ios") {
      const permission = await Contacts.requestPermission();
      return permission === "authorized";
    }
    return false;
  }

  /**
   * Chunked reader & batch uploader to prevent main thread freezing
   */
  static async syncContactsInChunks(
    userId: string,
    defaultCountryCode: string = "1",
    onProgress: SyncProgressCallback
  ): Promise<{ success: boolean; totalSynced: number }> {
    try {
      // 1. Fetch raw device contacts asynchronously
      const allContacts = await Contacts.getAll();
      if (!allContacts || allContacts.length === 0) {
        onProgress({ processed: 0, total: 0, percentage: 100 });
        return { success: true, totalSynced: 0 };
      }

      // Flatten contact numbers into single list items
      const contactItems: RawContactItem[] = [];
      for (const contact of allContacts) {
        const displayName = [contact.givenName, contact.familyName].filter(Boolean).join(" ");
        if (!displayName) continue;

        for (const phoneObj of contact.phoneNumbers) {
          if (phoneObj.number) {
            contactItems.push({
              name: displayName,
              phone: phoneObj.number,
            });
          }
        }
      }

      const totalItems = contactItems.length;
      let totalSynced = 0;

      // 2. Process & upload in chunks of 100 items
      for (let i = 0; i < totalItems; i += BATCH_CHUNK_SIZE) {
        const chunk = contactItems.slice(i, i + BATCH_CHUNK_SIZE);

        const response = await fetch(SYNC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            default_country_code: defaultCountryCode,
            contacts: chunk,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          totalSynced += resData.processed_count || chunk.length;
        }

        const processedSoFar = Math.min(i + chunk.length, totalItems);
        const percentage = Math.round((processedSoFar / totalItems) * 100);

        // Update progress state
        onProgress({
          processed: processedSoFar,
          total: totalItems,
          percentage: percentage,
        });

        // Micro-delay to yield execution to UI frame loop (prevents 60fps drops)
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      return { success: true, totalSynced };
    } catch (error) {
      console.error("Failed to sync contacts in chunks:", error);
      throw error;
    }
  }
}
