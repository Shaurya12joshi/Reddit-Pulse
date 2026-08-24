function PostCard({post}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      {post.title && <h3 className="mb-1 text-base font-semibold leading-snug text-slate-900">
        {post.title}
      </h3>}
      
      {post.body && <p className="mb-3 whitespace-pre-line text-sm text-slate-600 line-clamp-3">
        {post.body}
      </p>}

      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
        {post.author && <span className="font-medium text-slate-700">u/{post.author}</span>}
        <span aria-hidden="true">·</span>
        {post.subreddit && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
          r/{post.subreddit}
        </span>}
        <span aria-hidden="true">·</span>
        {post.timestamp && <time dateTime={new Date(post.timestamp).toISOString()}>{new Date(post.timestamp).toLocaleDateString()}</time>}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span aria-hidden="true">▲</span>
            {<span>{post.score}</span>}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true">💬</span>
            {<span>{post.numComments}</span>}
          </span>
        </div>

        <a
          href={post.url}
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
