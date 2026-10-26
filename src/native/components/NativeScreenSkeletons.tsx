import { StyleSheet, View } from "react-native";
import { useNativeTheme } from "../contexts/NativeThemeProvider";
import NativeSkeleton from "./NativeSkeleton";

function useSkeletonSurface() {
  const { theme, isVibesPro } = useNativeTheme();
  if (theme === "bluesky") return { backgroundColor: "#0b2d5b", borderColor: "#3478bd" };
  if (isVibesPro) return { backgroundColor: "#101010", borderColor: "#765c22" };
  return { backgroundColor: "rgba(255,255,255,0.72)", borderColor: "rgba(148,163,184,0.22)" };
}

export function NativeConversationRowsSkeleton({ count = 5 }: { count?: number }) {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.conversationRows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.conversationRow, surface]}>
          <NativeSkeleton style={styles.conversationAvatar} />
          <View style={styles.conversationCopy}>
            <NativeSkeleton style={styles.conversationName} />
            <NativeSkeleton style={styles.conversationPreview} />
          </View>
          <View style={styles.conversationMeta}>
            <NativeSkeleton style={styles.conversationTime} />
            <NativeSkeleton style={styles.conversationStatus} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function NativeChatSkeleton() {
  return (
    <View style={styles.chatList}>
      <View style={[styles.chatBubbleRow, styles.chatIncoming]}><NativeSkeleton style={[styles.chatBubble, styles.chatBubbleShort]} /></View>
      <View style={[styles.chatBubbleRow, styles.chatOutgoing]}><NativeSkeleton style={[styles.chatBubble, styles.chatBubbleMedium]} /></View>
      <View style={[styles.chatBubbleRow, styles.chatIncoming]}><NativeSkeleton style={[styles.chatBubble, styles.chatBubbleLong]} /></View>
      <View style={[styles.chatBubbleRow, styles.chatOutgoing]}><NativeSkeleton style={[styles.chatBubble, styles.chatBubbleShort]} /></View>
      <View style={[styles.chatBubbleRow, styles.chatOutgoing]}><NativeSkeleton style={[styles.chatBubble, styles.chatBubbleLong]} /></View>
    </View>
  );
}

export function NativeCallHistoryRowsSkeleton({ count = 5 }: { count?: number }) {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.contactRows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.contactRow, surface]}>
          <NativeSkeleton style={styles.contactAvatar} />
          <View style={styles.contactCopy}>
            <NativeSkeleton style={styles.contactName} />
            <NativeSkeleton style={styles.contactDetail} />
          </View>
          <View style={styles.contactMeta}>
            <NativeSkeleton style={styles.contactTime} />
            <NativeSkeleton style={styles.contactStatus} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function NativeProfileSkeleton() {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.profileContent}>
      <View style={[styles.profileIdentity, surface]}>
        <NativeSkeleton style={styles.profileAvatar} />
        <NativeSkeleton style={styles.profileName} />
        <NativeSkeleton style={styles.profileBio} />
        <NativeSkeleton style={styles.profileBioShort} />
        <View style={styles.profileActions}>
          <NativeSkeleton style={styles.profileAction} />
          <NativeSkeleton style={styles.profileAction} />
        </View>
        <View style={styles.profileStats}>
          <NativeSkeleton style={styles.profileStat} />
          <NativeSkeleton style={styles.profileStat} />
          <NativeSkeleton style={styles.profileStat} />
        </View>
      </View>
      <NativeProfilePostsSkeleton />
    </View>
  );
}

export function NativeProfilePostsSkeleton({ carousel = false }: { carousel?: boolean }) {
  if (carousel) {
    return (
      <View style={styles.profileCarousel}>
        <NativeSkeleton style={styles.profileCarouselCard} />
        <NativeSkeleton style={styles.profileCarouselCard} />
      </View>
    );
  }

  return (
    <View style={styles.profilePost}>
      <NativeSkeleton style={styles.profilePostAuthor} />
      <NativeSkeleton style={styles.profilePostLine} />
      <NativeSkeleton style={styles.profilePostMedia} />
    </View>
  );
}

export function NativeTrackPlayerSkeleton() {
  return (
    <View style={styles.trackPlayer}>
      <NativeSkeleton style={styles.trackCover} />
      <NativeSkeleton style={styles.trackTitle} />
      <NativeSkeleton style={styles.trackArtist} />
      <NativeSkeleton style={styles.trackProgress} />
      <View style={styles.trackControls}>
        <NativeSkeleton style={styles.trackControl} />
        <NativeSkeleton style={styles.trackPlayControl} />
        <NativeSkeleton style={styles.trackControl} />
      </View>
      <View style={styles.trackActions}>
        <NativeSkeleton style={styles.trackAction} />
        <NativeSkeleton style={styles.trackAction} />
        <NativeSkeleton style={styles.trackAction} />
      </View>
    </View>
  );
}

export function NativeTrackRowsSkeleton({ count = 5 }: { count?: number }) {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.trackRows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.trackRow, surface]}>
          <NativeSkeleton style={styles.trackRowNumber} />
          <View style={styles.trackRowCopy}>
            <NativeSkeleton style={styles.trackRowTitle} />
            <NativeSkeleton style={styles.trackRowArtist} />
          </View>
          <NativeSkeleton style={styles.trackRowTrailing} />
        </View>
      ))}
    </View>
  );
}

export function NativeVerticalMediaSkeleton({ height }: { height: number }) {
  const { theme, isVibesPro } = useNativeTheme();
  const mediaSkeletonColor = theme === "bluesky" ? "#1b4e80" : isVibesPro ? "#252a33" : "#273747";
  const backgroundColor = theme === "bluesky" ? "#061a3a" : isVibesPro ? "#080b12" : "#10141b";
  return (
    <View style={[styles.mediaPage, { height, backgroundColor }]}>
      <View style={styles.mediaImage}>
        <NativeSkeleton style={[styles.mediaShineBlock, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaShineSmall, { backgroundColor: mediaSkeletonColor }]} />
      </View>
      <View style={styles.mediaTopBar}>
        <NativeSkeleton style={[styles.mediaHeaderButton, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaHeaderTitle, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaHeaderButton, { backgroundColor: mediaSkeletonColor }]} />
      </View>
      <View style={styles.mediaDetails}>
        <NativeSkeleton style={[styles.mediaName, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaCaption, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaCaptionShort, { backgroundColor: mediaSkeletonColor }]} />
      </View>
      <View style={styles.mediaActions}>
        <NativeSkeleton style={[styles.mediaAction, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaAction, { backgroundColor: mediaSkeletonColor }]} />
        <NativeSkeleton style={[styles.mediaAction, { backgroundColor: mediaSkeletonColor }]} />
      </View>
    </View>
  );
}

export function NativeSearchRowsSkeleton({ count = 4 }: { count?: number }) {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.searchRows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.searchRow, surface]}>
          <NativeSkeleton style={styles.searchAvatar} />
          <View style={styles.searchCopy}>
            <NativeSkeleton style={styles.searchName} />
            <NativeSkeleton style={styles.searchDetail} />
          </View>
          <NativeSkeleton style={styles.searchChevron} />
        </View>
      ))}
    </View>
  );
}

export function NativeNotificationRowsSkeleton({ count = 5 }: { count?: number }) {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.notificationRows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.notificationRow, surface]}>
          <NativeSkeleton style={styles.notificationAvatar} />
          <View style={styles.notificationCopy}>
            <NativeSkeleton style={styles.notificationGreeting} />
            <NativeSkeleton style={styles.notificationActor} />
            <NativeSkeleton style={styles.notificationMessage} />
            <NativeSkeleton style={styles.notificationTime} />
          </View>
          <NativeSkeleton style={styles.notificationDelete} />
        </View>
      ))}
    </View>
  );
}

export function NativeSettingsSkeleton() {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.settingsContent}>
      <View style={[styles.settingsIdentity, surface]}>
        <NativeSkeleton style={styles.settingsAvatar} />
        <View style={styles.settingsIdentityCopy}>
          <NativeSkeleton style={styles.settingsName} />
          <NativeSkeleton style={styles.settingsEmail} />
        </View>
      </View>
      {[0, 1, 2].map((section) => (
        <View key={section} style={[styles.settingsSection, surface]}>
          <NativeSkeleton style={styles.settingsSectionTitle} />
          {[0, 1, 2].slice(0, section === 0 ? 3 : 2).map((row) => (
            <View key={row} style={styles.settingsRow}>
              <NativeSkeleton style={styles.settingsIcon} />
              <View style={styles.settingsRowCopy}>
                <NativeSkeleton style={styles.settingsRowTitle} />
                <NativeSkeleton style={styles.settingsRowDetail} />
              </View>
              <NativeSkeleton style={styles.settingsArrow} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function NativePeopleRowsSkeleton({ blocked = false, count = 5 }: { blocked?: boolean; count?: number }) {
  const surface = useSkeletonSurface();
  return (
    <View style={styles.contactRows}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={[styles.contactRow, surface]}>
          <NativeSkeleton style={styles.contactAvatar} />
          <View style={styles.contactCopy}>
            <NativeSkeleton style={styles.contactName} />
            {blocked ? <NativeSkeleton style={styles.contactDetail} /> : null}
          </View>
          {blocked ? <NativeSkeleton style={styles.peopleAction} /> : <NativeSkeleton style={styles.peopleChevron} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  conversationRows: { gap: 8 },
  conversationRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)" },
  conversationAvatar: { width: 42, height: 42, borderRadius: 15 },
  conversationCopy: { flex: 1, gap: 8 },
  conversationName: { width: "48%", height: 13 },
  conversationPreview: { width: "76%", height: 11 },
  conversationMeta: { alignItems: "flex-end", gap: 8 },
  conversationTime: { width: 38, height: 9 },
  conversationStatus: { width: 13, height: 13, borderRadius: 7 },
  chatList: { flex: 1, justifyContent: "flex-end", gap: 13, paddingHorizontal: 14, paddingVertical: 18 },
  chatBubbleRow: { width: "100%", flexDirection: "row" },
  chatIncoming: { justifyContent: "flex-start" },
  chatOutgoing: { justifyContent: "flex-end" },
  chatBubble: { height: 54, borderRadius: 18 },
  chatBubbleShort: { width: "48%" },
  chatBubbleMedium: { width: "64%", height: 68 },
  chatBubbleLong: { width: "72%", height: 76 },
  contactRows: { gap: 9, padding: 14 },
  contactRow: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 11, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)" },
  contactAvatar: { width: 42, height: 42, borderRadius: 21 },
  contactCopy: { flex: 1, gap: 8 },
  contactName: { width: "53%", height: 13 },
  contactDetail: { width: "38%", height: 10 },
  contactMeta: { alignItems: "flex-end", gap: 7 },
  contactTime: { width: 44, height: 9 },
  contactStatus: { width: 54, height: 9 },
  peopleAction: { width: 64, height: 30, borderRadius: 12 },
  peopleChevron: { width: 11, height: 17 },
  profileContent: { padding: 14, paddingBottom: 30, gap: 14 },
  profileIdentity: { alignItems: "center", padding: 18, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 22, backgroundColor: "rgba(255,255,255,0.68)" },
  profileAvatar: { width: 90, height: 90, borderRadius: 48 },
  profileName: { width: "42%", height: 20, marginTop: 13 },
  profileBio: { width: "84%", height: 13, marginTop: 16 },
  profileBioShort: { width: "54%", height: 13, marginTop: 8 },
  profileActions: { flexDirection: "row", gap: 9, marginTop: 18 },
  profileAction: { width: 118, height: 44, borderRadius: 14 },
  profileStats: { width: "100%", flexDirection: "row", justifyContent: "space-around", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(148,163,184,0.2)" },
  profileStat: { width: 48, height: 28, borderRadius: 8 },
  profileCarousel: { flexDirection: "row", gap: 12 },
  profileCarouselCard: { width: 180, height: 160, borderRadius: 16 },
  profilePost: { gap: 11 },
  profilePostAuthor: { width: "42%", height: 13 },
  profilePostLine: { width: "78%", height: 13 },
  profilePostMedia: { width: "100%", height: 150, borderRadius: 15 },
  trackPlayer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20 },
  trackCover: { width: "78%", maxWidth: 330, aspectRatio: 1, borderRadius: 24 },
  trackTitle: { width: "68%", height: 18, marginTop: 8 },
  trackArtist: { width: "44%", height: 13 },
  trackProgress: { width: "90%", height: 6, marginTop: 15, borderRadius: 4 },
  trackControls: { flexDirection: "row", alignItems: "center", gap: 28, marginTop: 8 },
  trackControl: { width: 34, height: 34, borderRadius: 18 },
  trackPlayControl: { width: 58, height: 58, borderRadius: 30 },
  trackActions: { flexDirection: "row", gap: 24, marginTop: 14 },
  trackAction: { width: 32, height: 32, borderRadius: 16 },
  trackRows: { gap: 8 },
  trackRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 14 },
  trackRowNumber: { width: 30, height: 30, borderRadius: 9 },
  trackRowCopy: { flex: 1, gap: 7 },
  trackRowTitle: { width: "58%", height: 12 },
  trackRowArtist: { width: "36%", height: 9 },
  trackRowTrailing: { width: 34, height: 10 },
  mediaPage: { width: "100%", overflow: "hidden", backgroundColor: "#080b12" },
  mediaImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 12 },
  mediaShineBlock: { width: "72%", height: "25%", borderRadius: 24, opacity: 0.35 },
  mediaShineSmall: { width: "44%", height: 18, borderRadius: 10, opacity: 0.3 },
  mediaTopBar: { position: "absolute", top: 58, right: 18, left: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mediaHeaderButton: { width: 40, height: 40, borderRadius: 14 },
  mediaHeaderTitle: { width: 80, height: 18, borderRadius: 9 },
  mediaDetails: { position: "absolute", left: 18, bottom: 42, width: "75%", gap: 10 },
  mediaName: { width: "52%", height: 14 },
  mediaCaption: { width: "100%", height: 12 },
  mediaCaptionShort: { width: "67%", height: 12 },
  mediaActions: { position: "absolute", right: 17, bottom: 54, alignItems: "center", gap: 20 },
  mediaAction: { width: 38, height: 38, borderRadius: 20 },
  searchRows: { gap: 9 },
  searchRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, padding: 11, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.62)" },
  searchAvatar: { width: 42, height: 42, borderRadius: 21 },
  searchCopy: { flex: 1, gap: 8 },
  searchName: { width: "52%", height: 13 },
  searchDetail: { width: "38%", height: 10 },
  searchChevron: { width: 12, height: 16 },
  notificationRows: { gap: 10, paddingVertical: 10 },
  notificationRow: { minHeight: 112, flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 17, backgroundColor: "rgba(255,255,255,0.65)" },
  notificationAvatar: { width: 42, height: 42, borderRadius: 23 },
  notificationCopy: { flex: 1, gap: 8, paddingTop: 2 },
  notificationGreeting: { width: "70%", height: 10 },
  notificationActor: { width: "44%", height: 13 },
  notificationMessage: { width: "88%", height: 11 },
  notificationTime: { width: "25%", height: 9, marginTop: 2 },
  notificationDelete: { width: 22, height: 22, borderRadius: 12 },
  settingsContent: { gap: 14, padding: 14, paddingBottom: 30 },
  settingsIdentity: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 13, padding: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.22)", borderRadius: 18, backgroundColor: "rgba(255,255,255,0.06)" },
  settingsAvatar: { width: 52, height: 52, borderRadius: 27 },
  settingsIdentityCopy: { flex: 1, gap: 9 },
  settingsName: { width: "52%", height: 15 },
  settingsEmail: { width: "68%", height: 10 },
  settingsSection: { gap: 9, padding: 14, borderWidth: 1, borderColor: "rgba(148,163,184,0.18)", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)" },
  settingsSectionTitle: { width: 100, height: 12, marginBottom: 4 },
  settingsRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11 },
  settingsIcon: { width: 34, height: 34, borderRadius: 11 },
  settingsRowCopy: { flex: 1, gap: 7 },
  settingsRowTitle: { width: "44%", height: 12 },
  settingsRowDetail: { width: "72%", height: 9 },
  settingsArrow: { width: 10, height: 15 },
});