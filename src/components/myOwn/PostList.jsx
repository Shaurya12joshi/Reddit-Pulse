import PostCard from './PostCard'

function PostList({posts}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => <PostCard post={post} key={post.id}/>) }
    </div>
  )
}

export default PostList
