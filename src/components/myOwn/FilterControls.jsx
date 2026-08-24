function FilterControls(/* TODO: props for current filter/sort values + their setters */) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
      {/* subreddit filter — TODO: build the <option> list from the unique subreddits in posts */}
      <select
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All subreddits</option>
      </select>

      {/* type filter */}
      <select
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">All types</option>
        <option value="post">Posts</option>
        <option value="comment">Comments</option>
      </select>

      {/* sort */}
      <select
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="score">Top score</option>
      </select>

      {/* free-text search across post.text */}
      <input
        type="text"
        placeholder="Search text…"
        className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {/* TODO: resets every control back to "no filter" */}
      <button
        type="button"
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        Clear all
      </button>
    </div>
  )
}

export default FilterControls
