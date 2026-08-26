const PROHIBITED = [
  /\bno\s+(?:self[-\s]?promo|promotion|advertis|marketing|solicit)/i,
  /\b(?:self[-\s]?promotion|advertising|promotional content)\s+(?:is\s+)?(?:not\s+allowed|prohibited|banned|forbidden)/i,
  /\bno\s+(?:brand|company|corporate|vendor)\s+(?:account|rep|shill)/i,
  /\bban(?:ned)?\s+(?:for|on)\s+(?:spam|promotion|advertising)/i,
  /\bzero\s+tolerance\s+for\s+(?:spam|self[-\s]?promo)/i,
]

const RESTRICTED = [
  /\b(?:disclose|disclosure|must\s+identify|identify\s+yourself)/i,
  /\bself[-\s]?promo(?:tion)?\s+(?:is\s+)?(?:limited|restricted|allowed\s+only|permitted\s+only)/i,
  /\b(?:9|10|90)[:\s]?1\s+rule/i,
  /\bvendor\s+(?:flair|thread|megathread)/i,
  /\bmod(?:erator)?\s+(?:approval|permission)\s+(?:is\s+)?required/i,
  /\bonly\s+on\s+(?:designated|specific)\s+(?:days|threads)/i,
]

export function assessPromoRisk(entry) {
  const text = (entry?.rules ?? [])
    .map((rule) => `${rule.short_name || ''} ${rule.description || ''}`)
    .join('\n')

  if (!text.trim()) return { promoRisk: 'unclear', matched: [] }

  const prohibited = PROHIBITED.filter((pattern) => pattern.test(text))
  if (prohibited.length) {
    return { promoRisk: 'prohibited', matched: matchedRules(entry, PROHIBITED) }
  }

  const restricted = RESTRICTED.filter((pattern) => pattern.test(text))
  if (restricted.length) {
    return { promoRisk: 'restricted', matched: matchedRules(entry, RESTRICTED) }
  }

  return { promoRisk: 'unclear', matched: [] }
}

function matchedRules(entry, patterns) {
  return (entry?.rules ?? [])
    .filter((rule) => {
      const text = `${rule.short_name || ''} ${rule.description || ''}`
      return patterns.some((pattern) => pattern.test(text))
    })
    .map((rule) => rule.short_name || String(rule.description || '').slice(0, 90))
    .slice(0, 4)
}

export function gateRecommendation({ threadId, subreddit, recommendation, rulesEntry }) {
  const posting = !['monitor_only', 'escalate_internally', 'do_not_participate'].includes(
    recommendation.action,
  )
  const { promoRisk, matched } = assessPromoRisk(rulesEntry)

  let status = 'pending'
  let blockedReason = null

  if (posting && promoRisk === 'prohibited') {
    status = 'blocked'
    blockedReason =
      `r/${subreddit} prohibits brand participation` +
      (matched.length ? ` — "${matched[0]}"` : '') +
      '. Recommendation kept for visibility; it cannot be approved.'
  }

  return {
    threadId,
    subreddit,
    status,
    blockedReason,
    recommendation: {
      ...recommendation,
      promo_risk: promoRisk,
      community_rules_matched: matched,
      disclosure_required: posting
        ? recommendation.disclosure_required !== false
        : false,
      requires_human_approval: true,
    },
    rulesSnapshot: rulesEntry ? { name: rulesEntry.name, rules: rulesEntry.rules, promoRisk } : null,
  }
}
