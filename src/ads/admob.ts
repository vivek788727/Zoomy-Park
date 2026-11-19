import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  MaxAdContentRating,
} from '@capacitor-community/admob';

// Replace these Google official test Ad Unit IDs with your real AdMob IDs before Play Store release
const ANDROID_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const ANDROID_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

let initialized = false;
let bannerVisible = false;
let racesSinceInterstitial = 0;

export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  try {
    await AdMob.initialize({
      initializeForTesting: true,
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
      maxAdContentRating: MaxAdContentRating.General,
    });
    initialized = true;
  } catch (err) {
    console.warn('AdMob init skipped:', err);
  }
}

export async function showMenuBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform() || bannerVisible) return;
  try {
    await initializeAdMob();
    await AdMob.showBanner({
      adId: ANDROID_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
      isTesting: true,
    });
    bannerVisible = true;
  } catch (err) {
    console.warn('AdMob showBanner skipped:', err);
  }
}

export async function hideMenuBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !bannerVisible) return;
  try {
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (err) {
    console.warn('AdMob hideBanner skipped:', err);
  }
}

export async function maybeShowBetweenRaceInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  racesSinceInterstitial += 1;
  // Kid-friendly pacing: only every 2 completed races, never mid-drive
  if (racesSinceInterstitial < 2) return;
  racesSinceInterstitial = 0;

  try {
    await initializeAdMob();
    await AdMob.prepareInterstitial({
      adId: ANDROID_INTERSTITIAL_ID,
      isTesting: true,
    });
    await AdMob.showInterstitial();
  } catch (err) {
    console.warn('AdMob interstitial skipped:', err);
  }
}
