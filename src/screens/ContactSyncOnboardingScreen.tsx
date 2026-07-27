import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { ContactSyncService } from "../services/ContactSyncService";

export const ContactSyncOnboardingScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; percentage: number }>({
    processed: 0,
    total: 0,
    percentage: 0,
  });

  const handleStartSync = async () => {
    const hasPermission = await ContactSyncService.requestContactsPermission();
    if (!hasPermission) {
      Alert.alert(
        "Permission Required",
        "Contact permissions are needed to identify incoming unknown callers and protect your phone from spam."
      );
      return;
    }

    setIsSyncing(true);

    try {
      const dummyUserId = "user_device_9941";
      await ContactSyncService.syncContactsInChunks(dummyUserId, "1", (progressData) => {
        setProgress(progressData);
      });

      setIsSyncing(false);
      Alert.alert("Sync Complete!", "Your caller registry is up to date.", [
        { text: "Continue", onPress: onComplete },
      ]);
    } catch (error) {
      setIsSyncing(false);
      Alert.alert("Sync Failed", "Could not complete contact sync. Please check your internet connection.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>🛡️</Text>
        </View>

        <Text style={styles.title}>Crowdsourced Caller Protection</Text>
        <Text style={styles.description}>
          Help protect your community against spam calls. Your contacts are anonymized and stored securely
          in E.164 format to build the real-time caller ID index.
        </Text>

        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>🔒 Privacy First Guarantee</Text>
          <Text style={styles.privacyText}>
            • Numbers are normalized to standard E.164 format.{"\n"}
            • We never sell or share your personal phonebook.{"\n"}
            • Contact processing runs seamlessly in low-memory batches.
          </Text>
        </View>

        {isSyncing ? (
          <View style={styles.progressSection}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress.percentage}%` }]} />
            </View>
            <View style={styles.progressTextRow}>
              <Text style={styles.progressLabel}>Indexing contacts...</Text>
              <Text style={styles.progressPercent}>{progress.percentage}%</Text>
            </View>
            <Text style={styles.progressSubtext}>
              {progress.processed} of {progress.total} items processed
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleStartSync} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Enable Protection & Sync</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // Dark Slate
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    backgroundColor: "#1E293B",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#3B82F61F",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  privacyBox: {
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#334155",
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#38BDF8",
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 12,
    color: "#CBD5E1",
    lineHeight: 18,
  },
  progressSection: {
    width: "100%",
    marginVertical: 10,
  },
  progressBarBackground: {
    height: 12,
    width: "100%",
    backgroundColor: "#334155",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 10,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 6,
  },
  progressTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  progressPercent: {
    fontSize: 14,
    color: "#38BDF8",
    fontWeight: "bold",
  },
  progressSubtext: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  button: {
    width: "100%",
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
