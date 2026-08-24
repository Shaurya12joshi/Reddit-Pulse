function PostCard(/* TODO: destructure the post prop here */) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* TODO: only posts have a title — comments should render no <h3> at all,
          not an empty one (that's the "empty title gap" the roadmap warns about) */}
      <h3 className="mb-1 text-base font-semibold leading-snug text-slate-900">
        title goes here
      </h3>

      <p className="mb-3 whitespace-pre-line text-sm text-slate-600 line-clamp-3">
        body / text goes here
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        <span className="font-medium text-slate-700">u/author</span>
        <span aria-hidden="true">·</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
          r/subreddit
        </span>
        <span aria-hidden="true">·</span>
        {/* TODO: format timestamp with toLocaleDateString() */}
        <time dateTime="">readable date goes here</time>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span aria-hidden="true">▲</span>
            <span>score</span>
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">💬</span>
            <span>numComments</span>
          </span>
        </div>

        <a
          href="#"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
        >
          View on Reddit →
        </a>
      </div>
    </article>
  )
}

export default PostCard
