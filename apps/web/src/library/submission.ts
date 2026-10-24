import type { SaveReceipt, TextSubmission } from '@sprout/contracts';

export type TextDraft = {
  readonly originalText: string;
  readonly savingIntent: string;
};

export type SubmissionState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'editing'; readonly draft: TextDraft; readonly issue?: 'invalid' | 'offline' }
  | { readonly kind: 'saving'; readonly payload: TextSubmission }
  | {
      readonly kind: 'unconfirmed';
      readonly payload: TextSubmission;
      readonly issue: 'offline' | 'unavailable';
    }
  | { readonly kind: 'conflict'; readonly payload: TextSubmission }
  | {
      readonly kind: 'saved';
      readonly payload: TextSubmission;
      readonly receipt: SaveReceipt;
    };

export type SubmissionAction =
  | { readonly type: 'open' }
  | { readonly type: 'edit'; readonly field: keyof TextDraft; readonly value: string }
  | { readonly type: 'clear-issue' }
  | { readonly type: 'invalid' }
  | { readonly type: 'offline' }
  | { readonly type: 'retry-offline' }
  | { readonly type: 'saving'; readonly payload: TextSubmission }
  | { readonly type: 'unconfirmed'; readonly issue: 'offline' | 'unavailable' }
  | { readonly type: 'conflict' }
  | { readonly type: 'saved'; readonly receipt: SaveReceipt }
  | { readonly type: 'close' };

const emptyDraft = (): TextDraft => ({ originalText: '', savingIntent: '' });

export function submissionReducer(
  state: SubmissionState,
  action: SubmissionAction,
): SubmissionState {
  switch (action.type) {
    case 'open':
      return state.kind === 'closed'
        ? { kind: 'editing', draft: emptyDraft() }
        : state;
    case 'edit':
      if (state.kind !== 'editing') return state;
      return {
        kind: 'editing',
        draft: { ...state.draft, [action.field]: action.value },
      };
    case 'clear-issue':
      return state.kind === 'editing'
        ? { kind: 'editing', draft: state.draft }
        : state;
    case 'invalid':
      if (state.kind === 'editing')
        return { kind: 'editing', draft: state.draft, issue: 'invalid' };
      if (state.kind === 'saving')
        return {
          kind: 'editing',
          draft: {
            originalText: state.payload.originalText,
            savingIntent: state.payload.savingIntent ?? '',
          },
          issue: 'invalid',
        };
      return state;
    case 'offline':
      return state.kind === 'editing'
        ? { kind: 'editing', draft: state.draft, issue: 'offline' }
        : state;
    case 'retry-offline':
      return state.kind === 'unconfirmed'
        ? { ...state, issue: 'offline' }
        : state;
    case 'saving':
      return { kind: 'saving', payload: action.payload };
    case 'unconfirmed':
      return state.kind === 'saving'
        ? {
            kind: 'unconfirmed',
            payload: state.payload,
            issue: action.issue,
          }
        : state;
    case 'conflict':
      return state.kind === 'saving'
        ? { kind: 'conflict', payload: state.payload }
        : state;
    case 'saved':
      return state.kind === 'saving'
        ? { kind: 'saved', payload: state.payload, receipt: action.receipt }
        : state;
    case 'close':
      return { kind: 'closed' };
  }
}
