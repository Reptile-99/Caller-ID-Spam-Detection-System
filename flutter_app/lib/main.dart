import 'package:flutter/material.dart';
import 'contact_sync_onboarding_screen.dart';
import 'call_history_log_screen.dart';

void main() {
  runApp(const CallerIdApp());
}

class CallerIdApp extends StatelessWidget {
  const CallerIdApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Caller ID & Spam Protection',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.deepPurple,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        useMaterial3: true,
      ),
      home: const MainTabNavigator(),
    );
  }
}

class MainTabNavigator extends StatefulWidget {
  const MainTabNavigator({Key? key}) : super(key: key);

  @override
  State<MainTabNavigator> createState() => _MainTabNavigatorState();
}

class _MainTabNavigatorState extends State<MainTabNavigator> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final List<Widget> screens = [
      CallHistoryLogScreen(),
      ContactSyncOnboardingScreen(
        onComplete: () {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Contact sync completed successfully!'),
              backgroundColor: Colors.green,
            ),
          );
        },
      ),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.history),
            selectedIcon: Icon(Icons.history, color: Colors.blueAccent),
            label: 'Call Log',
          ),
          NavigationDestination(
            icon: Icon(Icons.sync),
            selectedIcon: Icon(Icons.sync, color: Colors.deepPurpleAccent),
            label: 'Sync Contacts',
          ),
        ],
      ),
    );
  }
}
