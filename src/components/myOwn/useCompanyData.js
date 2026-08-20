import { useState } from "react";
import {normalizePosts} from "./normalize";
function useCompanyData() {
    const [status, setStatus] = useState("idle");
    const [posts, setPosts] = useState([]);
    const [error, setError] = useState(null);
    async function search(companyName) {   
        try {
            setStatus("loading");
            const codedName = encodeURIComponent(companyName)
            const response = await fetch(`http://localhost:3001/api/results?company=${codedName}`)
            if(response.status===404){
                setError(`No data scraped for ${companyName} yet`)
                setStatus("error")
                return
            }
            const isOk = response.ok
            if(!isOk){
                setError(`Something went wrong while fetching the data, status code: ${response.status}`)
                setStatus("error")
                return 
            }
            const data = await response.json()
            const normalizedPosts = normalizePosts(data.posts)
            setPosts(normalizedPosts)
            setStatus("ready")
            setError(null)
        } catch (error) {
            setError("Network error")
            setStatus("error")
        }  
    }
    return {status, posts, error, search}

}

export default useCompanyData