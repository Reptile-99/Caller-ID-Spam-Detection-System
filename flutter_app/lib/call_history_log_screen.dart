import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class CallLogModel {
  final String id;
  final String phoneNumber;
  final String name;
  final String callType;
  final String time;
  final String riskLevel; // SAFE, LOW_RISK, SUSPECTED_SPAM, HIGH_RISK_SPAM
  final int spamScore;

  CallLogModel({
    required this.id,
    required this.phoneNumber,
    required this.name,
    required this.callType,
    required this.time,
    required this.riskLevel,
    required this.spamScore,
  });
}

class CallHistoryLogScreen extends StatefulWidget {
  const CallHistoryLogScreen({Key? key}) : super(key: key);

  @override
  _CallHistoryLogScreenState createState() => _CallHistoryLogScreenState();
}

class _CallHistoryLogScreenState extends State<CallHistoryLogScreen> {
  late List<CallLogModel> _logs;

  @override
  void initState() {
    super.initState();
    _logs = List.generate(500, (i) {
      String risk = (i % 7 == 0)
          ? "HIGH_RISK_SPAM"
          : (i % 4 == 0)
              ? "SUSPECTED_SPAM"
              : "SAFE";
      return CallLogModel(
        id: "log_$i",
        phoneNumber: "+1 (415) 555-${1000 + (i % 8999)}",
        name: (risk == "HIGH_RISK_SPAM")
            ? "Spam Telemarketer Inc"
            : (risk == "SUSPECTED_SPAM")
                ? "Suspected Robocall"
                : "John Doe $i",
        callType: (i % 2 == 0) ? "incoming" : "missed",
        time: "${(i % 12) + 1}:30 PM",
        riskLevel: risk,
        spamScore: (risk == "HIGH_RISK_SPAM") ? 92 : 0,
      );
    });
  }

  void _openSpamReportSheet(String phoneNumber) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => SpamReportBottomSheet(phoneNumber: phoneNumber),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("Call Log History", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
            Text("Long-press any entry to report spam", style: TextStyle(color: Color(0xFF64748B), fontSize: 12)),
          ],
        ),
      ),
      body: ListView.builder(
        itemCount: _logs.length,
        itemExtent: 80, // Fixed height for 60fps virtualization performance
        itemBuilder: (context, index) {
          final log = _logs[index];
          return GestureDetector(
            onLongPress: () => _openSpamReportSheet(log.phoneNumber),
            child: Container(
              height: 80,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: const BoxDecoration(
                      color: Color(0xFF1E293B),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        log.callType == "incoming" ? "↙️" : "❌",
                        style: const TextStyle(fontSize: 18),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                log.name,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (log.riskLevel != "SAFE") _buildRiskBadge(log.riskLevel),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(log.phoneNumber, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13)),
                            Text(log.time, style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildRiskBadge(String riskLevel) {
    Color bg = (riskLevel == "HIGH_RISK_SPAM")
        ? const Color(0xFFEF4444)
        : const Color(0xFFF59E0B);
    String label = (riskLevel == "HIGH_RISK_SPAM") ? "SPAM" : "SUSPECTED";

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(10)),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}

class SpamReportBottomSheet extends StatefulWidget {
  final String phoneNumber;
  const SpamReportBottomSheet({Key? key, required this.phoneNumber}) : super(key: key);

  @override
  _SpamReportBottomSheetState createState() => _SpamReportBottomSheetState();
}

class _SpamReportBottomSheetState extends State<SpamReportBottomSheet> {
  String _selectedCategory = "telemarketer";
  final TextEditingController _nameController = TextEditingController();
  bool _isSubmitting = false;

  final List<Map<String, String>> _categories = [
    {"id": "telemarketer", "label": "Telemarketer", "icon": "📞"},
    {"id": "scam", "label": "Scam / Fraud", "icon": "🚨"},
    {"id": "robocall", "label": "Robocall", "icon": "🤖"},
    {"id": "debt_collector", "label": "Debt Collector", "icon": "💳"},
  ];

  Future<void> _submitReport() async {
    setState(() { _isSubmitting = true; });

    try {
      final res = await http.post(
        Uri.parse("https://your-supabase-project.supabase.co/functions/v1/spam-report"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "phone": widget.phoneNumber,
          "category": _selectedCategory,
          "suggested_name": _nameController.text.trim(),
          "reporter_user_id": "flutter_user_99",
        }),
      );

      setState(() { _isSubmitting = false; });

      if (res.statusCode == 200) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Spam report submitted! Thank you.")),
        );
      }
    } catch (e) {
      setState(() { _isSubmitting = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: 24, left: 24, right: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF1E293B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFF475569), borderRadius: BorderRadius.circular(2))),
          const SizedBox(height: 16),
          const Text("Report Spam Number", style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          Text(widget.phoneNumber, style: const TextStyle(color: Color(0xFF38BDF8), fontSize: 14, fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _categories.map((cat) {
              bool selected = _selectedCategory == cat["id"];
              return ChoiceChip(
                label: Text("${cat['icon']} ${cat['label']}"),
                selected: selected,
                selectedColor: const Color(0xFF2563EB),
                backgroundColor: const Color(0xFF0F172A),
                labelStyle: TextStyle(color: selected ? Colors.white : const Color(0xFF94A3B8)),
                onSelected: (val) {
                  setState(() { _selectedCategory = cat["id"]!; });
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _nameController,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: "Caller Name Suggestion (Optional)",
              hintStyle: const TextStyle(color: Color(0xFF64748B)),
              filled: true,
              fillColor: const Color(0xFF0F172A),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
              onPressed: _isSubmitting ? null : _submitReport,
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text("Submit Spam Report", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}
