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

## Step 4 — HTTP requests & APIs (in progress)

- **Wasn't sure how to run two functions from one `onSubmit`** — a handler prop only takes one function reference, but that function's body can call as many other functions as needed, one after another, just like it already calls `console.log` and `setName`; call the new function from inside `submitHandler` instead of trying to attach a second handler.
