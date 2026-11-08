import { motion } from 'framer-motion'
import type { Digest } from '@total-tossup-live/shared'
import { digestLines } from '@total-tossup-live/shared'

interface AwayDigestProps {
  digest: Digest
  onDismiss: () => void
}

/**
 * "While you were away" — what happened during an absence, shown on the
 * way back in.
 *
 * Deliberately an overlay on top of the live view rather than a screen in
 * front of it. The reason someone opened the app is to watch the game, and
 * a catch-up card that has to be cleared before the game appears is a toll
 * booth. This sits over the top with the broadcast running behind it,
 * dismissible by tapping anywhere, and gone for good once dismissed — the
 * digest describes one moment and there's nothing to come back to.
 *
 * The headline/context split is the whole shape of the feature and the
 * layout says so: at most three weighted headlines in display type, then
 * the unweighted standing lines underneath in body type. A Week closing
 * happens ninety-three times a day and could never earn a headline, but
 * it's exactly what you want underneath one — keeping the two visually
 * separate is what lets the headlines stay short.
 */
export function AwayDigest({ digest, onDismiss }: AwayDigestProps) {
  const { title, headlines, context } = digestLines(digest)

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* The scrim is the dismiss target, so a tap anywhere outside the
       * card gets you to the game. */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 bg-fg/40"
      />

      <motion.div
        role="status"
        // max-h/overflow because three headlines is a real possibility and
        // the display face is large: a record change, a long run ending and
        // a comeback can all land in one absence, and in that case the card
        // is taller than a phone. Scrolls rather than being clipped by the
        // viewport, which is the one failure mode that would hide the
        // dismiss button.
        className="relative flex max-h-[85dvh] w-full max-w-sm flex-col gap-4 overflow-y-auto border-2 border-fg bg-card p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <p className="font-body text-sm uppercase tracking-wide text-fg/70">{title}</p>

        {headlines.length > 0 && (
          <div className="flex flex-col gap-2">
            {headlines.map((line) => (
              <p key={line} className="font-display text-2xl leading-tight text-fg">
                {line}
              </p>
            ))}
          </div>
        )}

        {/* The rule divides headlines from context, so with no headlines
         * there's nothing for it to divide — a long absence produces
         * exactly that, and the rule would otherwise hang under the title
         * separating it from nothing. */}
        <div
          className={`flex flex-col gap-1 ${headlines.length > 0 ? 'border-t-2 border-fg/20 pt-3' : ''}`}
        >
          {context.map((line) => (
            <p key={line} className="font-body text-base text-fg">
              {line}
            </p>
          ))}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-1 self-end border-2 border-fg bg-bg px-4 py-1 font-display text-lg text-fg"
        >
          Watch
        </button>
      </motion.div>
    </motion.div>
  )
}
