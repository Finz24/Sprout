import { useEffect, useReducer, useRef, useState, type RefObject } from 'react';
import { Link, useBlocker } from '@tanstack/react-router';
import { Schema } from 'effect';
import { LayoutGroup } from 'motion/react';
import * as m from 'motion/react-m';
import {
  OriginalText,
  SubmissionId,
  type TextSubmission,
} from '@sprout/contracts';
import { Button, Textarea, buttonVariants } from '@sprout/ui';
import { session } from '../session.js';
import { CopyTextButton } from './copy-text-button.js';
import {
  displayRetentionTime,
  freezeSubmission,
  LibraryFailure,
  saveText,
} from './api.js';
import { submissionReducer, type SubmissionState } from './submission.js';

const freshState: SubmissionState = {
  kind: 'editing',
  draft: { originalText: '', savingIntent: '' },
};

function canLoseSubmission(state: SubmissionState) {
  return state.kind === 'editing'
    ? state.draft.originalText.length > 0 || state.draft.savingIntent.length > 0
    : state.kind === 'saving' ||
        state.kind === 'unconfirmed' ||
        state.kind === 'conflict';
}

function frozenFields(state: SubmissionState) {
  return state.kind === 'saving' ||
    state.kind === 'unconfirmed' ||
    state.kind === 'conflict' ||
    state.kind === 'saved'
    ? state.payload
    : undefined;
}

function SaveReceipt({
  state,
  onStartNew,
}: {
  readonly state: Extract<SubmissionState, { kind: 'saved' }>;
  readonly onStartNew: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="save-receipt" aria-live="polite">
      <m.h2
        ref={heading}
        tabIndex={-1}
        layoutId="text-save-action"
        className="receipt-heading"
      >
        Saved
      </m.h2>
      <time dateTime={state.receipt.retainedAt}>
        {displayRetentionTime(state.receipt.retainedAt)}
      </time>
      <p className="receipt-original" dir="auto">
        {state.payload.originalText}
      </p>
      {state.payload.savingIntent !== null ? (
        <p className="receipt-intent" dir="auto">
          {state.payload.savingIntent}
        </p>
      ) : null}
      <div className="receipt-actions">
        <Link
          to="/library/items/$itemId"
          params={{ itemId: state.receipt.itemId }}
          search={{ from: '/library' }}
          className="text-link"
        >
          Open Original input
        </Link>
        <CopyTextButton text={state.payload.originalText} />
        <Button variant="outline" className="touch-target" onClick={onStartNew}>
          New card
        </Button>
      </div>
      <p className="schedule-notice">
        Not scheduled. Requests in this text are kept only. Nothing is
        scheduled.
      </p>
    </div>
  );
}

function DraftIssue({
  issue,
}: {
  readonly issue: 'invalid' | 'offline' | undefined;
}) {
  if (issue === 'invalid')
    return (
      <p className="composer-error" role="alert">
        Enter valid text to save. The original stays unchanged.
      </p>
    );
  if (issue === 'offline')
    return (
      <p className="composer-error" role="alert">
        You are offline. Reconnect, then save this original.
      </p>
    );
  return null;
}

function UnconfirmedAlert({
  issue,
  hideNewSave,
  onRetry,
  onAskNew,
}: {
  readonly issue: 'offline' | 'unavailable';
  readonly hideNewSave: boolean;
  readonly onRetry: () => void;
  readonly onAskNew: () => void;
}) {
  return (
    <div className="composer-error" role="alert">
      <p>
        {issue === 'offline'
          ? 'You are offline. Reconnect, then retry this same save.'
          : 'Save not confirmed. Retry to check.'}
      </p>
      <Button
        className="touch-target retry-save"
        disabled={!navigator.onLine}
        onClick={onRetry}
      >
        Retry save
      </Button>
      {hideNewSave ? null : (
        <Button variant="outline" className="touch-target" onClick={onAskNew}>
          Start a new save
        </Button>
      )}
    </div>
  );
}

function ConflictAlert({
  hideNewSave,
  onAskNew,
}: {
  readonly hideNewSave: boolean;
  readonly onAskNew: () => void;
}) {
  return (
    <div className="composer-error" role="alert">
      <p>This save identity already holds different text.</p>
      {hideNewSave ? null : (
        <Button variant="outline" className="touch-target" onClick={onAskNew}>
          Start a new save
        </Button>
      )}
    </div>
  );
}

function DiscardCheck({
  kind,
  onKeepEditing,
  onConfirmDiscard,
}: {
  readonly kind: 'draft' | 'uncertain';
  readonly onKeepEditing: () => void;
  readonly onConfirmDiscard: () => void;
}) {
  return (
    <div className="discard-check" role="alert">
      <p>
        {kind === 'uncertain'
          ? 'This save may already be in your library. A new save can keep a second copy.'
          : 'Discard this text and its saving intent?'}
      </p>
      <Button
        variant="outline"
        className="touch-target"
        onClick={onKeepEditing}
      >
        Keep editing
      </Button>
      <Button className="touch-target" onClick={onConfirmDiscard}>
        {kind === 'uncertain' ? 'Start a new save' : 'Discard and close'}
      </Button>
    </div>
  );
}

function ComposerAlerts({
  state,
  discardPrompt,
  onRetry,
  onAskNew,
  onKeepEditing,
  onConfirmDiscard,
}: {
  readonly state: SubmissionState;
  readonly discardPrompt: 'draft' | 'uncertain' | null;
  readonly onRetry: () => void;
  readonly onAskNew: () => void;
  readonly onKeepEditing: () => void;
  readonly onConfirmDiscard: () => void;
}) {
  return (
    <>
      <DraftIssue issue={state.kind === 'editing' ? state.issue : undefined} />
      {state.kind === 'unconfirmed' ? (
        <UnconfirmedAlert
          issue={state.issue}
          hideNewSave={discardPrompt !== null}
          onRetry={onRetry}
          onAskNew={onAskNew}
        />
      ) : null}
      {state.kind === 'conflict' ? (
        <ConflictAlert
          hideNewSave={discardPrompt !== null}
          onAskNew={onAskNew}
        />
      ) : null}
      {discardPrompt ? (
        <DiscardCheck
          kind={discardPrompt}
          onKeepEditing={onKeepEditing}
          onConfirmDiscard={onConfirmDiscard}
        />
      ) : null}
    </>
  );
}

function ComposerForm({
  state,
  busy,
  canLose,
  discardPrompt,
  originalInput,
  onClose,
  onStartNew,
  onSubmit,
  onEdit,
  onClearIssue,
  onAskDiscard,
}: {
  readonly state: Exclude<
    SubmissionState,
    { kind: 'saved' } | { kind: 'closed' }
  >;
  readonly busy: boolean;
  readonly canLose: boolean;
  readonly discardPrompt: 'draft' | 'uncertain' | null;
  readonly originalInput: RefObject<HTMLTextAreaElement | null>;
  readonly onClose: () => void;
  readonly onStartNew: () => void;
  readonly onSubmit: () => void;
  readonly onEdit: (
    field: 'originalText' | 'savingIntent',
    value: string,
  ) => void;
  readonly onClearIssue: () => void;
  readonly onAskDiscard: (kind: 'draft' | 'uncertain' | null) => void;
}) {
  const payload = frozenFields(state);
  return (
    <form
      className="composer-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="composer-heading">
        <h2>New card</h2>
        <Button
          variant="outline"
          className="touch-target composer-close"
          disabled={busy}
          onClick={() => {
            if (!canLose) {
              onClose();
              return;
            }
            onAskDiscard(state.kind === 'editing' ? 'draft' : 'uncertain');
          }}
        >
          Close
        </Button>
      </div>
      <div className="composer-field">
        <div className="field-heading">
          <label htmlFor="original-input">Original input</label>
          {state.kind === 'editing' && state.draft.originalText.length > 0 ? (
            <CopyTextButton text={state.draft.originalText} />
          ) : null}
        </div>
        <Textarea
          ref={originalInput}
          id="original-input"
          aria-label="Original input"
          dir="auto"
          rows={8}
          spellCheck
          required
          disabled={state.kind !== 'editing'}
          value={
            state.kind === 'editing'
              ? state.draft.originalText
              : (payload?.originalText ?? '')
          }
          onChange={(event) =>
            onEdit('originalText', event.currentTarget.value)
          }
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
            if (event.key === 'Escape') {
              if (!canLose) {
                onClose();
                return;
              }
              onAskDiscard('draft');
            }
          }}
          placeholder="Paste or write something to keep"
          className="original-textarea"
        />
      </div>
      <div className="composer-field intent-field">
        <label htmlFor="saving-intent">Saving intent</label>
        <Textarea
          id="saving-intent"
          aria-label="Saving intent"
          dir="auto"
          rows={3}
          disabled={state.kind !== 'editing'}
          value={
            state.kind === 'editing'
              ? state.draft.savingIntent
              : (payload?.savingIntent ?? '')
          }
          onChange={(event) =>
            onEdit('savingIntent', event.currentTarget.value)
          }
          placeholder="Why do you want to keep it? (optional)"
        />
      </div>
      <p className="schedule-notice">
        Not scheduled. Requests in this text are kept only. Nothing is
        scheduled.
      </p>
      <ComposerAlerts
        state={state}
        discardPrompt={discardPrompt}
        onRetry={onSubmit}
        onAskNew={() => onAskDiscard('uncertain')}
        onKeepEditing={() => onAskDiscard(null)}
        onConfirmDiscard={() => {
          const kind = discardPrompt;
          onAskDiscard(null);
          if (kind === 'uncertain') onStartNew();
          else onClose();
        }}
      />
      <div className="composer-actions">
        {state.kind === 'editing' || state.kind === 'saving' ? (
          <m.button
            layoutId="text-save-action"
            className={buttonVariants({
              className: 'touch-target save-submit',
            })}
            type="submit"
            disabled={busy}
            onClick={onClearIssue}
          >
            {busy ? 'Saving…' : 'Save original'}
          </m.button>
        ) : null}
      </div>
    </form>
  );
}

function LeaveCheck({
  blocker,
}: {
  readonly blocker: ReturnType<typeof useBlocker>;
}) {
  if (blocker.status !== 'blocked') return null;
  return (
    <div className="discard-check" role="alert">
      <p>Leave without a confirmed save?</p>
      <Button
        variant="outline"
        className="touch-target"
        onClick={() => blocker.reset()}
      >
        Stay here
      </Button>
      <Button className="touch-target" onClick={() => blocker.proceed()}>
        Leave page
      </Button>
    </div>
  );
}

export function TextComposer({
  onClose,
  onRetained,
  onStartNew,
}: {
  readonly onClose: () => void;
  readonly onRetained: () => void;
  readonly onStartNew: () => void;
}) {
  const [state, dispatch] = useReducer(submissionReducer, freshState);
  const [discardPrompt, setDiscardPrompt] = useState<
    'draft' | 'uncertain' | null
  >(null);
  const originalInput = useRef<HTMLTextAreaElement>(null);
  const canLose = canLoseSubmission(state);
  const blocker = useBlocker({
    shouldBlockFn: () => canLose,
    withResolver: true,
    enableBeforeUnload: canLose,
  });

  const performSave = async (payload: TextSubmission) => {
    dispatch({ type: 'saving', payload });
    try {
      const receipt = await saveText(payload);
      dispatch({ type: 'saved', receipt });
      onRetained();
    } catch (error) {
      if (session.snapshot().kind !== 'Ready') return;
      if (error instanceof LibraryFailure && error.kind === 'conflict') {
        dispatch({ type: 'conflict' });
      } else if (error instanceof LibraryFailure && error.kind === 'invalid') {
        dispatch({ type: 'invalid' });
      } else {
        dispatch({
          type: 'unconfirmed',
          issue: navigator.onLine ? 'unavailable' : 'offline',
        });
      }
    }
  };

  const submit = async () => {
    if (state.kind === 'unconfirmed') {
      if (!navigator.onLine) {
        dispatch({ type: 'retry-offline' });
        return;
      }
      await performSave(state.payload);
      return;
    }
    if (state.kind !== 'editing') return;
    if (!navigator.onLine) {
      dispatch({ type: 'offline' });
      return;
    }
    try {
      Schema.decodeUnknownSync(OriginalText)(state.draft.originalText);
      await performSave(
        freezeSubmission({
          submissionId: Schema.decodeUnknownSync(SubmissionId)(
            crypto.randomUUID(),
          ),
          originalText: state.draft.originalText,
          savingIntent:
            state.draft.savingIntent === '' ? null : state.draft.savingIntent,
        }),
      );
    } catch {
      dispatch({ type: 'invalid' });
      originalInput.current?.focus();
    }
  };

  return (
    <LayoutGroup id="text-save-receipt">
      <section className="text-composer" aria-label="New card">
        {state.kind === 'saved' ? (
          <SaveReceipt state={state} onStartNew={onStartNew} />
        ) : state.kind === 'closed' ? null : (
          <ComposerForm
            state={state}
            busy={state.kind === 'saving'}
            canLose={canLose}
            discardPrompt={discardPrompt}
            originalInput={originalInput}
            onClose={onClose}
            onStartNew={onStartNew}
            onSubmit={() => void submit()}
            onEdit={(field, value) => dispatch({ type: 'edit', field, value })}
            onClearIssue={() => dispatch({ type: 'clear-issue' })}
            onAskDiscard={setDiscardPrompt}
          />
        )}
        <LeaveCheck blocker={blocker} />
      </section>
    </LayoutGroup>
  );
}
