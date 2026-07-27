import React, { useState, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ListRenderItemInfo,
} from "react-native";
import { SpamReportBottomSheet } from "../components/SpamReportBottomSheet";

export interface CallLogItem {
  id: string;
  phoneNumber: string;
  callerName: string;
  callType: "incoming" | "outgoing" | "missed" | "rejected";
  timestamp: string;
  duration: string;
  riskLevel: "SAFE" | "LOW_RISK" | "SUSPECTED_SPAM" | "HIGH_RISK_SPAM";
  spamScore: number;
  totalReports: number;
}

// Sample call log generator simulating thousands of records
const GENERATE_MOCK_LOGS = (count: number): CallLogItem[] => {
  const types: ("incoming" | "outgoing" | "missed" | "rejected")[] = [
    "incoming",
    "outgoing",
    "missed",
    "rejected",
  ];
  const risks: ("SAFE" | "LOW_RISK" | "SUSPECTED_SPAM" | "HIGH_RISK_SPAM")[] = [
    "SAFE",
    "SAFE",
    "LOW_RISK",
    "SUSPECTED_SPAM",
    "HIGH_RISK_SPAM",
  ];

  return Array.from({ length: count }, (_, i) => {
    const risk = risks[i % risks.length];
    return {
      id: `log_${i}`,
      phoneNumber: `+1 (415) 555-${1000 + (i % 8999)}`,
      callerName:
        risk === "HIGH_RISK_SPAM"
          ? "Spam Telemarketing Inc"
          : risk === "SUSPECTED_SPAM"
          ? "Suspected Robocall"
          : i % 3 === 0
          ? `User Contact ${i}`
          : "Unknown Number",
      callType: types[i % types.length],
      timestamp: `${(i % 12) + 1}:${i % 60 < 10 ? "0" : ""}${i % 60} ${i % 2 === 0 ? "AM" : "PM"}`,
      duration: `${(i % 5) + 1}m ${(i * 7) % 60}s`,
      riskLevel: risk,
      spamScore: risk === "HIGH_RISK_SPAM" ? 88 : risk === "SUSPECTED_SPAM" ? 54 : 0,
      totalReports: risk === "HIGH_RISK_SPAM" ? 42 : risk === "SUSPECTED_SPAM" ? 12 : 0,
    };
  });
};

const ITEM_HEIGHT = 80;

export const CallHistoryLogScreen: React.FC = () => {
  const [logs, setLogs] = useState<CallLogItem[]>(() => GENERATE_MOCK_LOGS(500));
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReportPhone, setSelectedReportPhone] = useState<string | null>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setLogs(GENERATE_MOCK_LOGS(500));
      setRefreshing(false);
    }, 800);
  }, []);

  const handleLongPress = useCallback((phone: string) => {
    setSelectedReportPhone(phone);
  }, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  const renderCallItem = useCallback(
    ({ item }: ListRenderItemInfo<CallLogItem>) => {
      const (badgeText, badgeBgColor) = getRiskBadgeDetails(item.riskLevel);

      return (
        <TouchableOpacity
          style={styles.logCard}
          onLongPress={() => handleLongPress(item.phoneNumber)}
          activeOpacity={0.7}
        >
          {/* Call Type Icon Indicator */}
          <View style={styles.iconWrapper}>
            <Text style={styles.callTypeIcon}>{getCallTypeSymbol(item.callType)}</Text>
          </View>

          {/* Caller Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.nameRow}>
              <Text style={styles.callerName} numberOfLines={1}>
                {item.callerName}
              </Text>
              {item.riskLevel !== "SAFE" && (
                <View style={[styles.badge, { backgroundColor: badgeBgColor }]}>
                  <Text style={styles.badgeText}>{badgeText}</Text>
                </View>
              )}
            </View>

            <View style={styles.subRow}>
              <Text style={styles.phoneNumber}>{item.phoneNumber}</Text>
              <Text style={styles.timestamp}>
                {item.timestamp} • {item.duration}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [handleLongPress]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Screen Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Call Log History</Text>
        <Text style={styles.headerSub}>Long-press any number to report spam</Text>
      </View>

      {/* 60FPS Virtualized Log List */}
      <FlatList
        data={logs}
        renderItem={renderCallItem}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        initialNumToRender={15}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38BDF8" />
        }
        contentContainerStyle={styles.listContent}
      />

      {/* In-App Spam Reporting Bottom Sheet */}
      <SpamReportBottomSheet
        visible={!!selectedReportPhone}
        phoneNumber={selectedReportPhone || ""}
        onClose={() => setSelectedReportPhone(null)}
        onSubmitted={() => {
          setSelectedReportPhone(null);
        }}
      />
    </SafeAreaView>
  );
};

function getRiskBadgeDetails(riskLevel: string): [string, string] {
  switch (riskLevel) {
    case "HIGH_RISK_SPAM":
      return ["SPAM", "#EF4444"]; // Crimson Red
    case "SUSPECTED_SPAM":
      return ["SUSPECTED", "#F59E0B"]; // Amber
    case "LOW_RISK":
      return ["LOW RISK", "#3B82F6"]; // Blue
    default:
      return ["SAFE", "#10B981"]; // Emerald Green
  }
}

function getCallTypeSymbol(type: string): string {
  switch (type) {
    case "incoming":
      return "↙️";
    case "outgoing":
      return "↗️";
    case "missed":
      return "❌";
    case "rejected":
      return "🚫";
    default:
      return "📞";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  headerSub: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  listContent: {
    paddingVertical: 8,
  },
  logCard: {
    height: ITEM_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  callTypeIcon: {
    fontSize: 18,
  },
  detailsContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  callerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  phoneNumber: {
    fontSize: 13,
    color: "#94A3B8",
  },
  timestamp: {
    fontSize: 12,
    color: "#64748B",
  },
});
