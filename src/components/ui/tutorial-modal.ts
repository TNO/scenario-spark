import m, { FactoryComponent } from 'mithril';
import { ModalPanel } from 'mithril-materialized';
import { i18n, t, Languages } from '../../services';

/** Languages with a narrated tutorial video; others fall back to the first one. */
export const TUTORIAL_VIDEO_LANGUAGES: Languages[] = ['en'];
/** Languages with tutorial subtitles */
export const TUTORIAL_SUBTITLE_LANGUAGES: Languages[] = ['en'];

const tutorialUrl = (file: string) => `${import.meta.env.BASE_URL}tutorials/${file}`;

/** Video and subtitle files of the tutorial for a UI language. */
export const tutorialSources = (language: Languages) => {
  const videoLanguage = TUTORIAL_VIDEO_LANGUAGES.includes(language) ? language : TUTORIAL_VIDEO_LANGUAGES[0];
  return {
    video: tutorialUrl(`spark-tutorial.${videoLanguage}.mp4`),
    tracks: TUTORIAL_SUBTITLE_LANGUAGES.map((lang) => ({
      lang,
      src: tutorialUrl(`spark-tutorial.${lang}.vtt`),
      isDefault: lang === language || (!TUTORIAL_SUBTITLE_LANGUAGES.includes(language) && lang === videoLanguage),
    })),
  };
};

export interface TutorialModalAttrs {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

/** Plays the tutorial on generating a complete scenario with an AI assistant. */
export const TutorialModal: FactoryComponent<TutorialModalAttrs> = () => ({
  view: ({ attrs: { isOpen, onToggle } }) => {
    const { video, tracks } = tutorialSources(i18n.currentLocale);
    return m(ModalPanel, {
      id: 'tutorial-modal',
      title: t('TUTORIAL_TITLE'),
      isOpen,
      onToggle,
      showCloseButton: true,
      description: m('.tutorial-content', [
        m('p.tutorial-intro', t('TUTORIAL_DESC')),
        // Only render the player while open, so closing the dialog stops playback.
        isOpen &&
          m(
            'video.tutorial-video',
            { controls: true, preload: 'metadata', playsinline: true, crossorigin: 'anonymous', src: video },
            tracks.map(({ lang, src, isDefault }) =>
              m('track', {
                kind: 'subtitles',
                srclang: lang,
                label: t('LANGUAGE_NAMES', lang),
                src,
                default: isDefault,
              }),
            ),
          ),
      ]),
    });
  },
});
