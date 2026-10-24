import { useState } from 'react';
import { Button } from '@sprout/ui';

export function CopyTextButton({ text }: { text: string }) {
  const [status, setStatus] = useState('');
  return (
    <span className="copy-text-control">
      <Button
        variant="outline"
        className="touch-target"
        onClick={() => {
          void navigator.clipboard
            .writeText(text)
            .then(() => setStatus('Copied'))
            .catch(() =>
              setStatus('Copy unavailable. Select the text to copy.'),
            );
        }}
      >
        Copy text
      </Button>
      <span role="status" aria-live="polite">
        {status}
      </span>
    </span>
  );
}
