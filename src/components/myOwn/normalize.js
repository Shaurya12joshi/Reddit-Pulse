export function normalizePosts(rawArray){
    let posts = rawArray.map((raw)=>normalizePost(raw))
    return posts
}
export function normalizePost(raw){
    const timestamp = new Date(raw.createdAt).getTime()
    let text;
    let author=raw.author;
    let score=raw.score;
    let numComments=raw.numComments;
    if(raw.title===null || raw.title===""){
        text = raw.body
    }
    else{
        text = raw.title + "\n" + raw.body
    }
    const isPost = raw.type==="post"
    if(raw.author===null || raw.author===""){
        author = "Deleted User"
    }
    if(raw.score===null){
        score = 0
    }
    if(raw.numComments===null || raw.numComments===0 ){
        numComments = 0
    }
    const normalizePostData = {
        id: raw.id,
        author,
        title: raw.title,
        body: raw.body,
        text,
        timestamp,
        numComments,
        permalink: raw.permalink,
        score,
        subreddit: raw.subreddit,
        isPost,
        url: raw.url
    }
    return normalizePostData
}
