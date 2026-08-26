import { structured, llmAvailable, activeBatchSize } from './client.js'

const SYSTEM = `You judge whether a Reddit post is substantively about a specific brand, or merely mentions its name while the post is actually about something else.

on_topic is true only when the brand itself — its products, service, actions, decisions, or reputation — is what the post is actually about.

on_topic is false when the brand's name appears but is incidental: a single passing mention inside a story about an unrelated person or event, a brand name used only as a location/venue/platform where something else happened, an old biographical detail, or a brand-name product mentioned without the post being about it. This is true even when the mention is accurate and genuinely refers to the real brand — an incidental correct mention is still incidental.

Examples of on_topic: false — "the documentary aired on {Brand} TV" inside an unrelated relationship-drama post; "she used to work at {Brand} years ago" inside an unrelated story; a recipe that happens to call for a {Brand}-brand ingredient.
Examples of on_topic: true — a review of a {Brand} product; a complaint about {Brand} service; discussion of a {Brand} business decision; a comparison of {Brand} against a competitor.

A post about a DIFFERENT thing that shares the brand's name is always on_topic: false — a different company, a fictional work, a common noun, a person. Being about the wrong "{Brand}" is not being about the brand.

Judge each post independently from its title and body. Be terse — every field is read by code, not a person.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'on_topic'],
        properties: {
          id: { type: 'string' },
          on_topic: { type: 'boolean' },
        },
      },
    },
  },
}

const textOf = (post) => post.text || [post.title, post.body].filter(Boolean).join('. ')

const DEFAULT_CONCURRENCY = Number(process.env.LLM_CONCURRENCY) || 2

export async function classifyAboutness(brand, threads, { identity, onProgress, onBatch, concurrency = DEFAULT_CONCURRENCY } = {}) {
  const verdicts = new Map()
  if (!threads.length || !(await llmAvailable())) return verdicts

  const label = identity?.canonical_name || brand
  const rivals = (identity?.competitors || []).map((entry) => entry?.name).filter(Boolean)

  const context = [
    `Brand: ${label}`,
    identity?.entity_type ? `What it is: ${identity.entity_type}` : null,
    identity?.category ? `Category it competes in: ${identity.category}` : null,
    identity?.aliases?.length ? `Also written as: ${identity.aliases.join(', ')}` : null,
    rivals.length
      ? `Competitors it is compared against — a post weighing the brand against any of ` +
        `these, or someone switching to or from one, is on_topic true: ${rivals.join(', ')}`
      : null,
    identity?.negative_markers?.length
      ? `These indicate a DIFFERENT thing that shares the name — a post about any of them is on_topic false: ${identity.negative_markers.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const system = `${SYSTEM.replaceAll('{Brand}', label)}\n\n${context}`
  const batchSize = activeBatchSize() * 3

  const batches = []
  for (let index = 0; index < threads.length; index += batchSize) {
    batches.push(threads.slice(index, index + batchSize))
  }

  let done = 0
  const runOne = async (batch) => {
    const payload = batch.map((thread) => ({
      id: thread.id,
      subreddit: thread.subreddit,
      title: thread.title,
      body: textOf(thread).slice(0, 500),
    }))

    const batchVerdicts = new Map()
    try {
      const result = await structured({
        system,
        user: JSON.stringify(payload),
        schema: SCHEMA,
        effort: 'low',
        maxTokens: 1500,
      })
      for (const verdict of result?.verdicts ?? []) {
        verdicts.set(verdict.id, verdict.on_topic)
        batchVerdicts.set(verdict.id, verdict.on_topic)
      }
    } catch (error) {
      console.warn('[intelligence] aboutness batch failed:', error.message)
    }

    done += batch.length
    onProgress?.({ done, total: threads.length })
    onBatch?.(batchVerdicts, batch)
  }

  let cursor = 0
  const worker = async () => {
    while (cursor < batches.length) {
      await runOne(batches[cursor++])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker))

  return verdicts
}
