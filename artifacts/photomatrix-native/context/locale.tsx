import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type Locale = 'en' | 'nl';
type Dictionary = Record<string, string>;
const dictionaries: Record<Locale, Dictionary> = {
  en: {
    home: 'Home', me: 'Me', darkroom: 'THE DARKROOM', gallery: 'Gallery', search: 'Search photographs…', share: 'Share this selection',
    loading: 'Loading the darkroom…', error: 'Unable to load the darkroom.', retry: 'Try again',
    offline: 'You appear to be offline.', empty: 'No photographs match these filters.', loadMore: 'Load more',
    refresh: 'Refresh', photographer: 'Photographer', allPhotographers: 'All photographers', from: 'From (UTC)',
    to: 'To (UTC)', group: 'Group', none: 'None', club: 'Club', theme: 'Theme', newest: 'Newest',
    oldest: 'Oldest', likes: 'Most liked', comments: 'Most discussed', random: 'Random', unknown: 'Unknown photographer',
    discover: 'DISCOVER', community: 'A directory of the PhotoMatrix community.', photographs: 'photographs',
    viewProfile: 'View profile', tellUs: 'Tell us what you see.', feedbackIntro: 'Your feedback helps keep the darkroom welcoming.',
    writeFeedback: 'Write your feedback…', consent: 'I consent to this feedback being reviewed.',
    diagnosticsConsent: 'Include anonymous device diagnostics (optional)', send: 'Send feedback', sending: 'Sending…',
    thankYou: 'Thank you', feedbackSent: 'Your feedback was sent.', cannotSend: 'Could not send feedback', feedback: 'Feedback',
    feedbackUnavailable: 'Feedback email is not configured.', explore: 'Explore the gallery', latest: 'Browse the latest club work',
    findPeople: 'Find your people', memberAccess: 'Member access', signInShare: 'Sign in to share your work',
    stories: 'Stories in light.', homeIntro: 'A quiet place for photographers, clubs, and the images between them.',
    clubs: 'Clubs', themes: 'Themes', photographers: 'Photographers', myPhotos: 'My photos', linkedPhotos: 'Photographs', photosUnavailable: 'Photographs could not be loaded.', noLinkedPhotos: 'No photographs yet.', unknownDirectory: 'This directory entry is not available.', directoryUnavailable: 'This directory entry could not be loaded.',
     signIn: 'Sign in', profile: 'Profile', invite: 'Invite', signInManage: 'Sign in to manage your photographs.',
     signOut: 'Sign out', photoTitle: 'Photo title', photoDescription: 'Description (optional)', library: 'Library', camera: 'Camera',
     loadingProfile: 'Loading profile…', permissionDenied: 'Permission denied', permissionSettings: 'Enable access in Settings to continue.',
     fileTooLarge: 'File too large', fileTooLargeBody: 'Choose an image smaller than 25 MB.', imagesOnly: 'Only image files are supported.',
     storageFailed: 'Storage upload failed.', uploadFailed: 'Upload failed', tryAgain: 'Please try again.', titleRequired: 'Title required',
     titleRequiredBody: 'Add a title before uploading or saving.', loadPhotosError: 'Could not load your photos.',
     noPhotos: 'You have not uploaded any photographs yet.', save: 'Save', edit: 'Edit', delete: 'Delete', cancel: 'Cancel',
     deleteConfirm: 'Delete this photograph?', saveFailed: 'Could not save', deleteFailed: 'Could not delete',
     inviteTitle: 'You are invited.', inviteIntro: 'Sign in before redeeming your club invitation.', inviteToken: 'Invite token', redeem: 'Redeem invite', inviteUnavailable: 'Invite unavailable',
     signInFailed: 'Sign in failed', signInFeedback: 'Sign in to send feedback.',
     authLoading: 'Loading authentication…',
     welcomeBack: 'Welcome back.', joinDarkroom: 'Join the darkroom.', checkEmail: 'Check your email.',
     emailSent: 'We sent a verification code to', verificationCode: 'Verification code', verifyEmail: 'Verify email',
     verificationIncomplete: 'Verification incomplete', verificationFailed: 'Verification failed', invalidCode: 'That code is not valid.',
     email: 'Email', password: 'Password', createAccount: 'Create account', newMember: 'New to PhotoMatrix? Create an account', existingMember: 'Already a member? Sign in',
     profileUnavailable: 'Could not load your profile.', createProfile: 'Create your profile.', profileLinked: 'Your photographer profile is linked.',
     name: 'Your name', createFailed: 'Could not create profile', signedOutProfile: 'Sign in to view your profile.',
     photographUnavailable: 'This photograph is unavailable.', conversation: 'Conversation', like: 'Like', liked: 'Liked',
     signInLike: 'Sign in to like photographs.', signInComment: 'Sign in to comment.',
     addComment: 'Add a comment…', post: 'Post', noComments: 'No comments yet.', likeFailed: 'Could not like photograph', commentFailed: 'Could not post comment',
  },
  nl: {
    home: 'Start', me: 'Ik', darkroom: 'DE DONKERE KAMER', gallery: 'Galerij', search: 'Foto’s zoeken…', share: 'Selectie delen',
    loading: 'Donkere kamer laden…', error: 'De donkere kamer kan niet worden geladen.', retry: 'Opnieuw proberen',
    offline: 'Je lijkt offline te zijn.', empty: 'Geen foto’s voldoen aan deze filters.', loadMore: 'Meer laden',
    refresh: 'Vernieuwen', photographer: 'Fotograaf', allPhotographers: 'Alle fotografen', from: 'Vanaf (UTC)',
    to: 'Tot (UTC)', group: 'Groeperen', none: 'Geen', club: 'Club', theme: 'Thema', newest: 'Nieuwste',
    oldest: 'Oudste', likes: 'Meeste likes', comments: 'Meeste reacties', random: 'Willekeurig', unknown: 'Onbekende fotograaf',
    discover: 'ONTDEKKEN', community: 'Een overzicht van de PhotoMatrix-gemeenschap.', photographs: 'foto’s',
    viewProfile: 'Profiel bekijken', tellUs: 'Vertel ons wat je ziet.', feedbackIntro: 'Jouw feedback houdt de donkere kamer gastvrij.',
    writeFeedback: 'Schrijf je feedback…', consent: 'Ik geef toestemming om deze feedback te beoordelen.',
    diagnosticsConsent: 'Anonieme apparaatgegevens toevoegen (optioneel)', send: 'Feedback versturen', sending: 'Versturen…',
    thankYou: 'Bedankt', feedbackSent: 'Je feedback is verstuurd.', cannotSend: 'Feedback kon niet worden verstuurd', feedback: 'Feedback',
    feedbackUnavailable: 'Feedback e-mail is niet ingesteld.', explore: 'Galerij bekijken', latest: 'Bekijk het nieuwste clubwerk',
    findPeople: 'Vind jouw mensen', memberAccess: 'Toegang voor leden', signInShare: 'Log in om je werk te delen',
    stories: 'Verhalen in licht.', homeIntro: 'Een rustige plek voor fotografen, clubs en de beelden daartussen.',
    clubs: 'Clubs', themes: 'Thema’s', photographers: 'Fotografen', myPhotos: 'Mijn foto’s', linkedPhotos: 'Foto’s', photosUnavailable: 'Foto’s konden niet worden geladen.', noLinkedPhotos: 'Nog geen foto’s.', unknownDirectory: 'Dit onderdeel is niet beschikbaar.', directoryUnavailable: 'Dit onderdeel kon niet worden geladen.',
     signIn: 'Inloggen', profile: 'Profiel', invite: 'Uitnodiging', signInManage: 'Log in om je foto’s te beheren.',
     signOut: 'Uitloggen', photoTitle: 'Fototitel', photoDescription: 'Beschrijving (optioneel)', library: 'Bibliotheek', camera: 'Camera',
     loadingProfile: 'Profiel laden…', permissionDenied: 'Toegang geweigerd', permissionSettings: 'Schakel toegang in Instellingen in.',
     fileTooLarge: 'Bestand te groot', fileTooLargeBody: 'Kies een afbeelding kleiner dan 25 MB.', imagesOnly: 'Alleen afbeeldingen zijn toegestaan.',
     storageFailed: 'Opslaan mislukt.', uploadFailed: 'Upload mislukt', tryAgain: 'Probeer opnieuw', titleRequired: 'Titel verplicht',
     titleRequiredBody: 'Voeg een titel toe voordat je opslaat.', loadPhotosError: 'Foto’s laden mislukt.',
     noPhotos: 'Je hebt nog geen foto’s geüpload.', save: 'Opslaan', edit: 'Bewerken', delete: 'Verwijderen', cancel: 'Annuleren',
     deleteConfirm: 'Deze foto verwijderen?', saveFailed: 'Opslaan mislukt', deleteFailed: 'Verwijderen mislukt',
     inviteTitle: 'Je bent uitgenodigd.', inviteIntro: 'Log in voordat je je clubuitnodiging gebruikt.', inviteToken: 'Uitnodigingstoken', redeem: 'Uitnodiging gebruiken', inviteUnavailable: 'Uitnodiging niet beschikbaar',
     signInFailed: 'Inloggen mislukt', signInFeedback: 'Log in om feedback te versturen.',
     authLoading: 'Authenticatie laden…',
     welcomeBack: 'Welkom terug.', joinDarkroom: 'Word lid van de donkere kamer.', checkEmail: 'Controleer je e-mail.',
     emailSent: 'We stuurden een verificatiecode naar', verificationCode: 'Verificatiecode', verifyEmail: 'E-mail verifiëren',
     verificationIncomplete: 'Verificatie niet voltooid', verificationFailed: 'Verificatie mislukt', invalidCode: 'Deze code is niet geldig.',
     email: 'E-mail', password: 'Wachtwoord', createAccount: 'Account maken', newMember: 'Nieuw bij PhotoMatrix? Account maken', existingMember: 'Al lid? Inloggen',
     profileUnavailable: 'Profiel laden mislukt.', createProfile: 'Maak je profiel.', profileLinked: 'Je fotografenprofiel is gekoppeld.',
     name: 'Je naam', createFailed: 'Profiel maken mislukt', signedOutProfile: 'Log in om je profiel te bekijken.',
     photographUnavailable: 'Deze foto is niet beschikbaar.', conversation: 'Gesprek', like: 'Vind ik leuk', liked: 'Leuk gevonden',
     signInLike: 'Log in om foto’s leuk te vinden.', signInComment: 'Log in om te reageren.',
     addComment: 'Reactie toevoegen…', post: 'Plaatsen', noComments: 'Nog geen reacties.', likeFailed: 'Foto leuk vinden mislukt', commentFailed: 'Reactie plaatsen mislukt',
  },
};
type LocaleValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key: string) => string };
const fallback: LocaleValue = { locale: 'en', setLocale: () => undefined, t: key => dictionaries.en[key] ?? key };
export const LocaleContext = createContext<LocaleValue>(fallback);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  useEffect(() => { AsyncStorage.getItem('photomatrix.locale').then(value => { if (value === 'en' || value === 'nl') setLocale(value); }); }, []);
  useEffect(() => { AsyncStorage.setItem('photomatrix.locale', locale).catch(() => undefined); }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key: string) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() { return useContext(LocaleContext); }
export const localeDictionaries = dictionaries;