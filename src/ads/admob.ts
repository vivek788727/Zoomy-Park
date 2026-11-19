import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
} from '@capacitor-community/admob';

export const ADMOB_CONFIG = {
  useTestAds: false,
  bannerId: 'ca-app-pub-2914220555628785/7538202832',
  interstitialId: 'ca-app-pub-2914220555628785/3172029522',
  interstitialCooldownMs: 25_000,
};

let initialized = false;
let bannerVisible = false;
let interstitialLoaded = false;
let interstitialLoading = false;
let lastInterstitialShownAt = 0;

export const isNativeAndroidOrIOS = (): boolean => Capacitor.isNativePlatform();

export async function initializeAdMob(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  try {
    await AdMob.initialize({
      initializeForTesting: ADMOB_CONFIG.useTestAds,
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
      maxAdContentRating: MaxAdContentRating.General,
    });

    await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      interstitialLoaded = true;
      interstitialLoading = false;
    });

    await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      interstitialLoaded = false;
      void preloadInterstitial();
    });

    await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
      interstitialLoaded = false;
      interstitialLoading = false;
    });

    initialized = true;
    if (ADMOB_CONFIG.interstitialId) {
      void preloadInterstitial();
    }
  } catch (err) {
    console.warn('AdMob init skipped:', err);
  }
}

export async function preloadInterstitial(): Promise<void> {
  if (
    !Capacitor.isNativePlatform() ||
    !ADMOB_CONFIG.interstitialId ||
    interstitialLoaded ||
    interstitialLoading
  ) {
    return;
  }
  interstitialLoading = true;
  try {
    await initializeAdMob();
    await AdMob.prepareInterstitial({
      adId: ADMOB_CONFIG.interstitialId,
      isTesting: ADMOB_CONFIG.useTestAds,
    });
    interstitialLoaded = true;
  } catch (err) {
    console.warn('AdMob preload interstitial skipped:', err);
  } finally {
    interstitialLoading = false;
  }
}

export async function showTopBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !ADMOB_CONFIG.bannerId || bannerVisible) return;
  try {
    await initializeAdMob();
    await AdMob.showBanner({
      adId: ADMOB_CONFIG.bannerId,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.TOP_CENTER,
      margin: 0,
      isTesting: ADMOB_CONFIG.useTestAds,
    });
    bannerVisible = true;
  } catch (err) {
    console.warn('AdMob showBanner skipped:', err);
  }
}

export async function hideTopBanner(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !bannerVisible) return;
  try {
    await AdMob.hideBanner();
    bannerVisible = false;
  } catch (err) {
    console.warn('AdMob hideBanner skipped:', err);
  }
}

export async function showGameOverInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !ADMOB_CONFIG.interstitialId) return;
  const now = Date.now();
  if (now - lastInterstitialShownAt < ADMOB_CONFIG.interstitialCooldownMs) {
    return;
  }

  try {
    await initializeAdMob();
    if (!interstitialLoaded) {
      await AdMob.prepareInterstitial({
        adId: ADMOB_CONFIG.interstitialId,
        isTesting: ADMOB_CONFIG.useTestAds,
      });
    }
    lastInterstitialShownAt = Date.now();
    interstitialLoaded = false;
    await AdMob.showInterstitial();
  } catch (err) {
    console.warn('AdMob interstitial skipped:', err);
    void preloadInterstitial();
  }
}
