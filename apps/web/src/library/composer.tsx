import { useEffect, useReducer, useRef, useState } from 'react';
import { Link, useBlocker } from '@tanstack/react-router';
import { Schema } from 'effect';
import { LayoutGroup, motion } from 'motion/react';
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
  const savedHeading = useRef<HTMLHeadingElement>(null);
  const originalInput = useRef<HTMLTextAreaElement>(null);
  const submitting = state.kind === 'saving';
  const canLose =
    state.kind === 'editing'
      ? state.draft.originalText.length > 0 ||
        state.draft.savingIntent.length > 0
      : state.kind === 'saving' ||
        state.kind === 'unconfirmed' ||
        state.kind === 'conflict';
  const blocker = useBlocker({
    shouldBlockFn: () => canLose,
    withResolver: true,
    enableBeforeUnload: canLose,
  });

  useEffect(() => {
    if (state.kind === 'saved') savedHeading.current?.focus();
  }, [state.kind]);

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
      const payload = freezeSubmission({
        submissionId: Schema.decodeUnknownSync(SubmissionId)(
          crypto.randomUUID(),
        ),
        originalText: state.draft.originalText,
        savingIntent:
          state.draft.savingIntent === '' ? null : state.draft.savingIntent,
      });
      await performSave(payload);
    } catch {
      dispatch({ type: 'invalid' });
      originalInput.current?.focus();
    }
  };

  const payload =
    state.kind === 'saving' ||
    state.kind === 'unconfirmed' ||
    state.kind === 'conflict' ||
    state.kind === 'saved'
      ? state.payload
      : undefined;
  const busy = submitting;

  return (
    <LayoutGroup id="text-save-receipt">
      <section className="text-composer" aria-label="New card">
        {state.kind === 'saved' ? (
          <div className="save-receipt" aria-live="polite">
            <motion.h2
              ref={savedHeading}
              tabIndex={-1}
              layoutId="text-save-action"
              className="receipt-heading"
            >
              Saved
            </motion.h2>
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
                onClick={onClose}
              >
                Open Original input
              </Link>
              <CopyTextButton text={state.payload.originalText} />
              <Button
                variant="outline"
                className="touch-target"
                onClick={onStartNew}
              >
                New card
              </Button>
            </div>
            <p className="schedule-notice">
              Not scheduled. Requests in this text are kept only. Nothing is
              scheduled.
            </p>
          </div>
        ) : (
          <form
            className="composer-form"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
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
                  setDiscardPrompt(
                    state.kind === 'editing' ? 'draft' : 'uncertain',
                  );
                }}
              >
                Close
              </Button>
            </div>
            <div className="composer-field">
              <div className="field-heading">
                <label htmlFor="original-input">Original input</label>
                {state.kind === 'editing' &&
                state.draft.originalText.length > 0 ? (
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
                  dispatch({
                    type: 'edit',
                    field: 'originalText',
                    value: event.currentTarget.value,
                  })
                }
                onKeyDown={(event) => {
                  if (
                    (event.ctrlKey || event.metaKey) &&
                    event.key === 'Enter'
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                  if (event.key === 'Escape') {
                    if (!canLose) {
                      onClose();
                      return;
                    }
                    setDiscardPrompt('draft');
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
                  dispatch({
                    type: 'edit',
                    field: 'savingIntent',
                    value: event.currentTarget.value,
                  })
                }
                placeholder="Why do you want to keep it? (optional)"
              />
            </div>
            <p className="schedule-notice">
              Not scheduled. Requests in this text are kept only. Nothing is
              scheduled.
            </p>
            {state.kind === 'editing' && state.issue === 'invalid' ? (
              <p className="composer-error" role="alert">
                Enter valid text to save. The original stays unchanged.
              </p>
            ) : null}
            {state.kind === 'editing' && state.issue === 'offline' ? (
              <p className="composer-error" role="alert">
                You are offline. Reconnect, then save this original.
              </p>
            ) : null}
            {state.kind === 'unconfirmed' ? (
              <div className="composer-error" role="alert">
                <p>
                  {state.issue === 'offline'
                    ? 'You are offline. Reconnect, then retry this same save.'
                    : 'Save not confirmed. Retry to check.'}
                </p>
                <Button
                  className="touch-target retry-save"
                  disabled={!navigator.onLine}
                  onClick={() => void submit()}
                >
                  Retry save
                </Button>
                {discardPrompt ? null : (
                  <Button
                    variant="outline"
                    className="touch-target"
                    onClick={() => setDiscardPrompt('uncertain')}
                  >
                    Start a new save
                  </Button>
                )}
              </div>
            ) : null}
            {state.kind === 'conflict' ? (
              <div className="composer-error" role="alert">
                <p>This save identity already holds different text.</p>
                {discardPrompt ? null : (
                  <Button
                    variant="outline"
                    className="touch-target"
                    onClick={() => setDiscardPrompt('uncertain')}
                  >
                    Start a new save
                  </Button>
                )}
              </div>
            ) : null}
            {discardPrompt ? (
              <div className="discard-check" role="alert">
                <p>
                  {discardPrompt === 'uncertain'
                    ? 'This save may already be in your library. A new save can keep a second copy.'
                    : 'Discard this text and its saving intent?'}
                </p>
                <Button
                  variant="outline"
                  className="touch-target"
                  onClick={() => setDiscardPrompt(null)}
                >
                  Keep editing
                </Button>
                <Button
                  className="touch-target"
                  onClick={() => {
                    setDiscardPrompt(null);
                    if (discardPrompt === 'uncertain') onStartNew();
                    else onClose();
                  }}
                >
                  {discardPrompt === 'uncertain'
                    ? 'Start a new save'
                    : 'Discard and close'}
                </Button>
              </div>
            ) : null}
            <div className="composer-actions">
              {state.kind === 'editing' || state.kind === 'saving' ? (
                <motion.button
                  layoutId="text-save-action"
                  className={buttonVariants({
                    className: 'touch-target save-submit',
                  })}
                  type="submit"
                  disabled={busy}
                  onClick={() => dispatch({ type: 'clear-issue' })}
                >
                  {busy ? 'Saving…' : 'Save original'}
                </motion.button>
              ) : null}
            </div>
          </form>
        )}
        {blocker.status === 'blocked' ? (
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
        ) : null}
      </section>
    </LayoutGroup>
  );
}
