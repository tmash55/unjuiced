import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import {
  AuthButton,
  AuthPanel,
  AuthScreenShell,
  authUiStyles,
} from "@/src/components/auth/AuthScreenShell";
import { useAuthOnboarding } from "@/src/components/auth/AuthOnboardingContext";
import { getSportsbookLogoUrl } from "@/src/lib/logos";
import { ALL_SPORTSBOOKS } from "@/src/lib/sportsbooks";
import { brandColors } from "@/src/theme/brand";

function BookLogo({ bookId }: { bookId: string }) {
  const uri = getSportsbookLogoUrl(bookId);

  if (!uri) {
    return (
      <View style={styles.bookFallback}>
        <Text style={styles.bookFallbackText}>{bookId.slice(0, 1).toUpperCase()}</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={styles.bookLogo} />;
}

export default function OnboardingBooksScreen() {
  const router = useRouter();
  const { selectedBooks, toggleBook } = useAuthOnboarding();

  return (
    <AuthScreenShell
      title="Which sportsbooks do you use?"
      subtitle="Set your outs once so the board feels relevant the moment you land."
      eyebrow="Step 2 of 3"
      footer={
        <Text style={authUiStyles.helperText}>
          Pick as many as you want. We’ll use these across the product.
        </Text>
      }
    >
      <AuthPanel>
        <ScrollView
          style={styles.booksScroll}
          contentContainerStyle={styles.booksGrid}
          showsVerticalScrollIndicator={false}
        >
          {ALL_SPORTSBOOKS.slice(0, 12).map((book) => {
            const active = selectedBooks.includes(book.id);
            return (
              <Pressable
                key={book.id}
                onPress={() => toggleBook(book.id)}
                style={[styles.bookCard, active ? styles.bookCardActive : null]}
              >
                <BookLogo bookId={book.id} />
                <Text style={styles.bookName}>{book.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <AuthButton
          label="Continue"
          icon="arrow-forward"
          onPress={() => router.push("/onboarding-subscribe")}
        />
      </AuthPanel>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  booksScroll: {
    maxHeight: 380,
  },
  booksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  bookCard: {
    width: "47%",
    minHeight: 88,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookCardActive: {
    borderColor: "rgba(125,211,252,0.32)",
    backgroundColor: "rgba(56,189,248,0.08)",
  },
  bookLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  bookFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bookFallbackText: {
    color: brandColors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  bookName: {
    color: brandColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
