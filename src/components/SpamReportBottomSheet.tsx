import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

export interface SpamReportBottomSheetProps {
  visible: boolean;
  phoneNumber: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const SPAM_CATEGORIES = [
  { id: "telemarketer", label: "Telemarketer", icon: "📞" },
  { id: "scam", label: "Scam / Fraud", icon: "🚨" },
  { id: "robocall", label: "Robocall", icon: "🤖" },
  { id: "debt_collector", label: "Debt Collector", icon: "💳" },
  { id: "survey", label: "Survey", icon: "📋" },
  { id: "other", label: "Other Spam", icon: "⚠️" },
];

const REPORT_API_URL = "https://your-supabase-project.supabase.co/functions/v1/spam-report";

export const SpamReportBottomSheet: React.FC<SpamReportBottomSheetProps> = ({
  visible,
  phoneNumber,
  onClose,
  onSubmitted,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("telemarketer");
  const [suggestedName, setSuggestedName] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmitReport = async () => {
    if (!phoneNumber) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(REPORT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          category: selectedCategory,
          suggested_name: suggestedName.trim() || undefined,
          comment: comment.trim() || undefined,
          reporter_user_id: "user_device_9941",
        }),
      });

      setIsSubmitting(false);

      if (response.ok) {
        Alert.alert("Report Submitted", "Thank you for helping protect the community!");
        setSuggestedName("");
        setComment("");
        onSubmitted();
        onClose();
      } else {
        const errJson = await response.json().catch(() => ({}));
        Alert.alert("Error", errJson.error || "Failed to submit report. Please try again.");
      }
    } catch (e) {
      setIsSubmitting(false);
      Alert.alert("Error", "Network error. Please check your connection.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.sheetContainer}
            >
              <View style={styles.dragHandle} />
              
              <Text style={styles.sheetTitle}>Report Spam Number</Text>
              <Text style={styles.phoneSubtitle}>{phoneNumber}</Text>

              <Text style={styles.sectionLabel}>Select Spam Category</Text>
              <View style={styles.categoryGrid}>
                {SPAM_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.chipIcon}>{cat.icon}</Text>
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.sectionLabel}>Caller Name (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. IRS Scam / Bank Telemarketer"
                placeholderTextColor="#64748B"
                value={suggestedName}
                onChangeText={setSuggestedName}
                maxLength={50}
              />

              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmitReport}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Spam Report</Text>
                )}
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)", // Semi-transparent dark slate backdrop
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderTopWidth: 1,
    borderColor: "#334155",
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#475569",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  phoneSubtitle: {
    fontSize: 14,
    color: "#38BDF8",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  categoryChip: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  categoryChipSelected: {
    backgroundColor: "#1E3A8A",
    borderColor: "#3B82F6",
  },
  chipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    color: "#CBD5E1",
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 24,
  },
  submitButton: {
    backgroundColor: "#EF4444", // Crimson Red
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
