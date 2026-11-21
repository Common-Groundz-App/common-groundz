/**
 * Phase 10B — read-only presentation of a review's saved structured answers.
 * Callers place this INSIDE the spoiler barrier; it hides empty sections and
 * renders nothing when there is nothing to show.
 */
import React from 'react';
import ReviewRecommendationBadge from './ReviewRecommendationBadge';
import StaticAttributeRings from './StaticAttributeRings';
import type { ReviewReaderDetails } from './readerDetails';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-xs font-semibold text-muted-foreground">{children}</h4>
);

const TAG_HEADINGS: Record<string, string> = {
  liked: 'What they liked',
  could_be_better: 'Could be better',
  best_for: 'Best for',
  food_tags: 'Sensory profile',
};

const ReviewQuestionnaireDetails: React.FC<{ details: ReviewReaderDetails }> = ({ details }) => {
  if (details.isEmpty) return null;
  const verdict = [...(details.repeatIntent ? [details.repeatIntent] : []), ...details.verdictChoices];
  return (
    <div className="space-y-4" data-testid="review-questionnaire-details">
      {(details.recommendation || verdict.length > 0) && (
        <section className="space-y-2">
          <Heading>Verdict</Heading>
          <ReviewRecommendationBadge value={details.recommendation} />
          {verdict.length > 0 && (
            <dl className="space-y-1">
              {verdict.map((c) => (
                <div key={c.fieldId} className="flex justify-between gap-3 text-sm">
                  <dt className="min-w-0 text-muted-foreground">{c.question}</dt>
                  <dd className="min-w-0 max-w-[50%] break-words text-right font-medium text-foreground">{c.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
      {details.experienceContext.length > 0 && (
        <section className="space-y-2">
          <Heading>Experience context</Heading>
          <dl className="space-y-1">
            {details.experienceContext.map((c) => (
              <div key={c.fieldId} className="flex justify-between gap-3 text-sm">
                <dt className="min-w-0 text-muted-foreground">{c.question}</dt>
                <dd className="min-w-0 max-w-[50%] break-words text-right font-medium text-foreground">{c.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {details.attributeRatings.length > 0 && (
        <section className="space-y-2">
          <Heading>Attribute ratings</Heading>
          <div className="space-y-2">
            {details.attributeRatings.map((a) => (
              <StaticAttributeRings key={a.id} label={a.label} value={a.value} />
            ))}
          </div>
        </section>
      )}
      {details.tagGroups.map((g) => (
        <section key={g.fieldId} className="space-y-2">
          <Heading>{TAG_HEADINGS[g.fieldId] ?? g.title}</Heading>
          <ul className="flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <li key={t.key} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-foreground">
                {t.emoji ? <span aria-hidden="true">{t.emoji} </span> : null}
                {t.label}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default ReviewQuestionnaireDetails;
