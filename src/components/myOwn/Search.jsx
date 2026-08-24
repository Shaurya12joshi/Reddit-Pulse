import React from 'react'
import { useState } from 'react'
import useCompanyData from './useCompanyData'
import PostList from './PostList'

function Search() {
    const [name, setName] = useState('')
    const {status, posts, error, search} = useCompanyData()
    const isLoading = status === 'loading'
    const isError  = status === 'error'
    const isReady = status === 'ready'
    const submitHandler =(e)=>{
        e.preventDefault()
        const value = name.trim()
         if(value.length===0){
            console.log("Please enter a company name")
            return
        }
        setName(value)
        console.log(`The company name is ${value}`)
        search(value)
    }
   
    return (

<div className="flex flex-col gap-6">
    <form className="flex items-center gap-3 max-w-md" onSubmit={submitHandler}>
      <input
        type="text"
        placeholder="Enter a company name"
        className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={name}
        onChange={(e)=>setName(e.target.value)}
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-indigo-700 transition-colors"
      > Analyze </button>
    </form>

    <div className="max-w-md text-sm text-slate-600">
      {isLoading && <p>Loading…</p>}
      {isError ? <p>{error}</p> : null}
      {isReady && <p>Found {posts.length} posts</p>}
    </div>

    <div className="w-full">
      {<PostList posts={posts}/>}
    </div>
  </div>
    )
}

export default Search
