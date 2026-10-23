import m, { FactoryComponent } from 'mithril';
import { ModalPanel } from 'mithril-materialized';
import { i18n, t, Languages } from '../../services';

/** Languages with tutorial narration and subtitles; others fall back to the first one. */
export const TUTORIAL_LANGUAGES: Languages[] = ['en', 'nl', 'de', 'fr', 'es', 'pl'];

const tutorialUrl = (file: string) => `${import.meta.env.BASE_URL}tutorials/${file}`;

/** The (silent) video, plus the narration and subtitle files of the tutorial for a narration language. */
export const tutorialSources = (language: Languages) => {
  const narration = TUTORIAL_LANGUAGES.includes(language) ? language : TUTORIAL_LANGUAGES[0];
  return {
    narration,
    video: tutorialUrl('spark-tutorial.mp4'),
    audio: tutorialUrl(`spark-tutorial.${narration}.m4a`),
    tracks: TUTORIAL_LANGUAGES.map((lang) => ({
      lang,
      src: tutorialUrl(`spark-tutorial.${lang}.vtt`),
      isDefault: lang === narration,
    })),
  };
};

/** Keeps the narration in step with the video: play, pause, seek, speed and volume. */
const syncAudio = (video: HTMLVideoElement, audio: HTMLAudioElement) => {
  const align = () => {
    if (Math.abs(audio.currentTime - video.currentTime) > 0.25) audio.currentTime = video.currentTime;
  };
  const play = () => {
    align();
    audio.play().catch(() => undefined);
  };
  const pause = () => audio.pause();
  video.addEventListener('play', play);
  video.addEventListener('playing', play);
  video.addEventListener('pause', pause);
  video.addEventListener('waiting', pause);
  video.addEventListener('seeked', align);
  video.addEventListener('timeupdate', align);
  video.addEventListener('ratechange', () => (audio.playbackRate = video.playbackRate));
  video.addEventListener('volumechange', () => {
    audio.volume = video.volume;
    audio.muted = video.muted;
  });
  // A new narration language loads a new source: continue where the video is
  audio.addEventListener('loadedmetadata', () => {
    audio.currentTime = video.currentTime;
    if (!video.paused) audio.play().catch(() => undefined);
  });
};

export interface TutorialModalAttrs {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

/** Plays the tutorial on generating a complete scenario with an AI assistant, narrated in the chosen language. */
export const TutorialModal: FactoryComponent<TutorialModalAttrs> = () => {
  let language: Languages | undefined;
  let video: HTMLVideoElement | undefined;
  let audio: HTMLAudioElement | undefined;

  const connect = () => video && audio && syncAudio(video, audio);

  return {
    view: ({ attrs: { isOpen, onToggle } }) => {
      if (!isOpen) language = undefined;
      const { narration, video: videoSrc, audio: audioSrc, tracks } = tutorialSources(language || i18n.currentLocale);
      return m(ModalPanel, {
        id: 'tutorial-modal',
        title: t('TUTORIAL_TITLE'),
        isOpen,
        onToggle,
        showCloseButton: true,
        description: m('.tutorial-content', [
          m('p.tutorial-intro', t('TUTORIAL_DESC')),
          // Only render the player while open, so closing the dialog stops playback.
          isOpen && [
            m('label.tutorial-language', [
              t('TUTORIAL_NARRATION'),
              m(
                'select.browser-default',
                {
                  value: narration,
                  onchange: (e: Event) => {
                    language = (e.target as HTMLSelectElement).value as Languages;
                    // Show the subtitles of the new narration language
                    if (video)
                      Array.from(video.textTracks).forEach(
                        (track) => (track.mode = track.language === language ? 'showing' : 'disabled'),
                      );
                  },
                },
                TUTORIAL_LANGUAGES.map((lang) => m('option', { value: lang }, t('LANGUAGE_NAMES', lang))),
              ),
            ]),
            m(
              'video.tutorial-video',
              {
                controls: true,
                preload: 'metadata',
                playsinline: true,
                crossorigin: 'anonymous',
                src: videoSrc,
                oncreate: ({ dom }) => {
                  video = dom as HTMLVideoElement;
                  connect();
                },
                onremove: () => (video = undefined),
              },
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
            m('audio', {
              src: audioSrc,
              preload: 'auto',
              oncreate: ({ dom }) => {
                audio = dom as HTMLAudioElement;
                connect();
              },
              onremove: () => (audio = undefined),
            }),
          ],
        ]),
      });
    },
  };
};
