/**
 * Reader for the Terms and Privacy Policy.
 *
 * These ship inside the app rather than opening a web page: someone reviewing
 * what they agreed to should not need a working connection, and store reviewers
 * check that the documents are reachable in-app.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LEGAL_DOCUMENTS, type LegalDocument } from '@/content/legal';
import { palette, space, type } from '@/theme/tokens';

export function LegalScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document: LegalDocument | undefined =
    LEGAL_DOCUMENTS[doc as LegalDocument['slug']] ?? undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable
          onPress={() => router.back()}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
        >
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>

        {!document ? (
          <Text style={styles.title}>Document not found</Text>
        ) : (
          <>
            <View style={styles.masthead}>
              <Text style={styles.eyebrow}>VERISNAP</Text>
              <Text style={styles.title}>{document.title}</Text>
              <Text style={styles.updated}>Last updated {document.updated}</Text>
            </View>

            <Text style={styles.intro}>{document.intro}</Text>

            {document.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.heading}>{section.heading}</Text>
                {section.paragraphs.map((paragraph, index) => (
                  <Text key={index} style={styles.paragraph}>
                    {paragraph}
                  </Text>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  scroll: { padding: space.xl, paddingBottom: space.xxl, gap: space.xl },
  back: { alignSelf: 'flex-start' },
  backGlyph: { ...type.data, color: palette.mist, fontSize: 18 },
  masthead: { gap: space.xs },
  eyebrow: { ...type.label, color: palette.cyan },
  title: { ...type.title, color: palette.chalk },
  updated: { ...type.dataSmall, color: palette.mist },
  intro: { ...type.body, color: palette.chalk },
  section: { gap: space.sm },
  heading: { ...type.label, color: palette.mist },
  paragraph: { ...type.body, color: palette.chalk },
});
