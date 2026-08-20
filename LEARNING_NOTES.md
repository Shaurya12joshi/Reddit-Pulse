# Learning Notes — Mistakes & Corrections

Running log of mistakes made while building this project, with one-sentence corrections. Updated after each roadmap step is completed.

---

## Step 3 — Company search input (complete)

- **Typo'd `e.preventDefault()` as `e.prevenetDefault()`** — a misspelled method name doesn't exist on the event object and throws a runtime error the moment it runs; always double-check exact spellings of built-in API methods.
- **Wrote `onClick={()=>submitHandler}` without calling it** — returning a function reference instead of invoking it (`submitHandler()`) means the handler never actually runs.
- **Put the submit handler on the button's `onClick` instead of the form's `onSubmit`** — forms can also be submitted by pressing Enter in an input, which only `onSubmit` on the `<form>` catches; `onClick` on the button misses that case.
- **Trimmed the value inside `onChange` on every keystroke** — trimming while the user is still typing strips trailing spaces immediately, making it impossible to type multi-word input; trim once, only at submit time.
- **Checked `if(name.length<=0)` using stale, untrimmed state right after calling `setName(name.trim())`** — `setState` doesn't update its variable within the same function call, so validating against the old value (and the wrong, untrimmed one) gives incorrect results; compute the trimmed value into a local variable first, then validate and use that local variable.
- **Called `onSubmit={()=>submitHandler()}` (and separately `onClick={()=>submitHandler()}`)** — invoking with no arguments means the handler's `e` parameter is `undefined`, so `e.preventDefault()` throws; when a handler's signature already matches what the event system will pass, hand over the function reference directly (`onSubmit={submitHandler}`) instead of wrapping it in an arrow function that drops the event.
- **Kept a redundant `onClick={()=>submitHandler()}` on the submit button alongside `onSubmit` on the form** — a `<button type="submit">` inside a `<form>` already triggers the form's `onSubmit` on click automatically, so a separate click handler is unnecessary and, here, was also broken the same way.
- **Wrote `onSubmit={()=>submitHandler(e)}`** — the wrapper arrow function takes no parameters, so `e` inside it isn't defined anywhere and throws `ReferenceError: e is not defined`.
- **Logged `console.log(`The company name is ${name}`)` using state (`name`) instead of the local trimmed variable (`value`)** — right after `setName(value)`, the `name` variable in this render's closure is still the old, pre-submit value ("stale closure"), since state updates apply on the next render, not immediately; log the local variable you already computed instead.
- **Didn't know why `onSubmit={submitHandler}` would work the same as `onSubmit={(e)=>submitHandler(e)}`** — React automatically calls any event handler prop with the event object as its one argument, so a wrapper arrow function that just forwards `e` unchanged is redundant; only wrap in an arrow function when you need to pass something *extra* or *different* from the raw event (like `onChange={(e)=>setName(e.target.value)}`, which pulls a value out of the event instead of forwarding it).

## Mentor phase, Step 1 — Fetching real data from the backend (complete)

- **Passed stale state into the fetch: `tryingFetch(name)` instead of `tryingFetch(value)`** — a repeat of the earlier stale-closure mistake; `setName(value)` doesn't update `name` in the same function call, so the untrimmed text got sent, and it only appeared to work because the backend happened to `.trim()` too — never rely on the other side's defensive coding to cover your own bug.
- **Error message omitted the HTTP status (`"Something went wrong"`)** — an error you can't diagnose costs far more time later; include `response.status` so a failure tells you *which* failure it was.
- **Thought 404 was a server error, and that check order was about "server before user" errors** — status families are `2xx` success, `4xx` *client* errors (404 lives here), `5xx` *server* errors; and the actual reason the 404 check must come first is that `response.ok` is false for 404 too, so a generic `!response.ok` check placed above it would swallow the 404 and make the specific message dead code — always check the specific case before the general case that also covers it.
- **Good call made independently:** replaced `throw new Error(...)` with `console.log` + `return` to match the 404 path — throwing only to catch it a few lines later in the same function is a pointless round-trip when the error is handled right there.

## Mentor phase, Step 3 — Normalizing raw data (complete)

- **Checked `raw.title.length === 0` *before* `raw.title === null`** — `||` evaluates left to right and stops at the first true side, so the `.length` access runs first and throws `TypeError: Cannot read properties of null` before the null check can protect anything; existence checks always go on the left. (Even shorter: `if (!raw.title)` covers `null`, `undefined` and `""` in one go, since all three are falsy.)
- **Wrote `if` blocks for defaults with no `else` branch** — `let author; if (raw.author === null) author = "Deleted User"` leaves `author` as `undefined` whenever the real data *is* present, silently wiping every valid value; either initialise from the raw value first (`let author = raw.author`) or use `raw.author ?? "Deleted User"`.
- **`normalizePost` built its result object but never returned it, then called `normalizePosts(...)` from inside itself** — the singular function's only job is to convert one item and hand it back; the plural one calls the singular, never the reverse, and calling `.map()` on a single object throws a `TypeError`.
- **Named a local variable the same as its enclosing function (`const normalizePost = {...}` inside `function normalizePost`)** — legal but confusing, since the name means two different things depending on where you read it.
- **Wrote `raw.type === "post" ? true : false`** — a comparison already evaluates to `true`/`false`, so the ternary adds nothing.

## Step 4 — HTTP requests & APIs (complete)

- **Wasn't sure how to run two functions from one `onSubmit`** — a handler prop only takes one function reference, but that function's body can call as many other functions as needed, one after another, just like it already calls `console.log` and `setName`; call the new function from inside `submitHandler` instead of trying to attach a second handler.
- **Didn't know `fetch` doesn't reject on HTTP error statuses (404, 500, etc.)** — `fetch` only rejects on total network failure, so a bad status code has to be checked manually via `response.ok` (a boolean) before trying to parse the body, otherwise you'd try to parse an error page as if it were valid data.
- **Tried to log a fetched object with `${data}` inside a template string, which printed `[object Object]`** — putting an object inside `${...}` calls `.toString()` on it, which doesn't show its contents; `console.log` accepts multiple comma-separated arguments and will print an object's actual contents when passed directly, e.g. `console.log('label', data)` instead of `` `label ${data}` ``.
- **Didn't know `encodeURIComponent()` was a built-in JS function** — it's part of the language (browser + Node, no import), and it escapes characters that have special meaning in a URL (`&`, `?`, `=`, spaces) so a value like `Ben & Jerry's` stays one intact query parameter instead of being cut short at the `&`; always wrap user-typed values before putting them in a URL.
- **`catch` block just re-threw the error (`throw error`) instead of logging it** — re-throwing from inside an `async` function that's called without `await`/`.catch()` elsewhere turns it into an unhandled promise rejection with no clear message; when the task is "handle the error for now," the `catch` block itself should `console.log` it.
