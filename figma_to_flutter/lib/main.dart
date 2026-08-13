import 'package:flutter/material.dart';
import 'generated/theme/app_theme.dart';
import 'generated/widgets/primary_button.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Figma to Flutter',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Figma to Flutter'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppTheme.spacingLg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.auto_awesome,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const SizedBox(width: AppTheme.spacingSm),
                        Text(
                          'Getting Started',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppTheme.spacingMd),
                    const Text(
                      'This app was created with Figma + MCP + Agent automation. '
                      'Use Cursor IDE to generate Flutter code from Figma designs.',
                    ),
                    const SizedBox(height: AppTheme.spacingMd),
                    PrimaryButton(
                      label: 'Open Figma URL',
                      icon: Icons.design_services,
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Paste your Figma URL in Cursor IDE'),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppTheme.spacingMd),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppTheme.spacingMd),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.code,
                          color: Theme.of(context).colorScheme.secondary,
                        ),
                        const SizedBox(width: AppTheme.spacingSm),
                        Text(
                          'Generated Code',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppTheme.spacingMd),
                    Text(
                      'Generated Flutter widgets will appear in:',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppTheme.spacingSm),
                    Container(
                      padding: const EdgeInsets.all(AppTheme.spacingSm),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
                      ),
                      child: const Text(
                        'lib/generated/',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
