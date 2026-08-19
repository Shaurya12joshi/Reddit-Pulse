import React from 'react'
import { useState } from 'react'

function Search() {
    const [name, setName] = useState('')
    const submitHandler =(e)=>{
        e.preventDefault()
        const value = name.trim()
         if(value.length===0){
            console.log("Please enter a company name")
            return
        }
        setName(value)
        console.log(`The company name is ${value}`)
        tryingFetch()
    }
    async function tryingFetch(){
        try {
            const response = await fetch("https://catfact.ninja/fact")
            const isOk = response.ok
            if(!isOk){
                throw new Error("Something went wrong while fetching the data")
            }
            const data = await response.json()
            
            console.log("The data we Fetched is", data)
        } catch (error) {
            console.log("Error while fetching data", error)
        }
    }
    return (
        <form className="flex items-center gap-3 max-w-md" onSubmit={submitHandler} >
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
      >
        Analyze
      </button>
    </form>
    )
}

export default Search
