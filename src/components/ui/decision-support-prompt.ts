import m from 'mithril';
import { ModalPanel } from 'mithril-materialized';
import { Dashboards } from '../../models';
import { MeiosisComponent, saveModel, t } from '../../services';
import { answerDecisionSupportPrompt, shouldPromptDecisionSupport } from '../../utils/decision';

/** Asks once per scenario whether to turn on decision support when the box has decision categories. */
export const DecisionSupportPrompt: MeiosisComponent = () => {
  const answer = async (attrs: Parameters<typeof saveModel>[0], enable: boolean) => {
    const { model } = attrs.getState();
    if (!model?.scenario) return;
    if (!enable && model.scenario.decisionSupportPrompted) return;
    answerDecisionSupportPrompt(model.scenario, enable);
    await saveModel(attrs, model);
  };
  return {
    view: ({ attrs }) => {
      const { model, modelReady, page } = attrs.state;
      const isOpen =
        !!modelReady && page !== Dashboards.HOME && shouldPromptDecisionSupport(model?.scenario);
      return m(ModalPanel, {
        id: 'decisionSupportPrompt',
        isOpen,
        onToggle: (open) => {
          if (!open) answer(attrs, false);
        },
        title: t('DECISION_PROMPT_TITLE'),
        description: m('div', [
          m('p', t('DECISION_PROMPT_MSG')),
          m('p', m('em', t('DECISION_PROMPT_LATER_NOTE'))),
        ]),
        closeOnButtonClick: true,
        buttons: [
          {
            label: t('DECISION_PROMPT_NOT_NOW'),
            iconName: 'schedule',
            onclick: () => answer(attrs, false),
          },
          {
            label: t('DECISION_PROMPT_ENABLE'),
            iconName: 'check',
            onclick: () => answer(attrs, true),
          },
        ],
      });
    },
  };
};
