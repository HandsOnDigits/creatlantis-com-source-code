export const PostType = {
    IMAGE: "image",
    JOURNAL: "journal",
    PROFILE: "profile"
}

export function UserMetadata(main = false) {
    return /*html*/`
        <a id="${main ? 'main-user' : ""}" href="#" title="Go to the user's profile" class="profile-link">
            <img class="user-icon" src="../images/default_pp.webp"/>
            <div class="user-metadata">
                <p class="user-name big-text">Name</p>
                <p class="user-tagline">Tagline</p>
            </div>
        </a>
    `;
}

export function Image(path, title = "", key = "") {
    return /*html*/`
        <img src="${path}" ` + (title != "" ? `title="${title}"` : ``) + ` class="post" data-key="${key}"/>
    `;
}

export function Journal(content, key = "") {
    return /*html*/`
        <div class="journal-content post" data-key="${key}">
            ${content}
        </div>
    `;
}

export function Profile(username, tagline, profileImage) {
    return /*html*/`
        <a href="#" title="Go to the user's profile" class="profile-link" data-key="${username}">
            <img class="user-icon" src="${profileImage}"/>
            <div class="user-metadata">
                <p class="user-name big-text">${username}</p>   
                <p class="user-tagline">${tagline}</p>
            </div>
        </a>
    `;
} 

export function DisplayLoadedPost(posts, traget) {
    if (!Array.isArray(posts) || posts.length === 0) return;

    posts.forEach(element => {
        switch (element.type) {
            case PostType.IMAGE:
                $(traget).append(Image(element.src, element.title, element.key));
                break;
            case PostType.JOURNAL:
                $(traget).append(Journal(element.body, element.key));
                break;
            case PostType.PROFILE:
                $(traget).append(Profile(element.username, element.tagline, element.profile_image));
                break;
        }
    });
}

export function OnPostThumbClick(post) {
    var key = $(post).attr("data-key");
    window.location.href = `post/${key}`;
}

export function RenderComment(comment) {
    return /*html*/ `
        <div class="comment" data-stack-uuid="${comment.stackUUID}">
            ${UserMetadata()}
            <div class="comment-body">${comment.body}</div>
            <div class="make-a-reply-container">
                <button class="reply" title="Start sending a reply to this comment">Reply</button>
                <!-- Reply form can be loaded here !-->
            </div>
            <div class="loaded-replies">
                <button class="load-replies" title="Load more replies from this comment">Replies</button>
                <!-- Load in replies here -->
            </div>
        </div>
    `;
}

export function SetupReplyContainer($comment) {
    if ($comment.find(".reply-form").length) return;

    $(".reply, #add-new-comment").hide();
    
    
    $comment.find(".make-a-reply-container").parent().append(/*html*/ `
        <textarea class="reply-form" cols="100" name="reply" rows="3">Add a reply...</textarea>
        <br/>
        <button id="cancel">Cancel</button>
    `);

    $comment.find("#cancel").on("click", () => {
        DestroyReplyContainer();
    });
}

export function DestroyReplyContainer() {
    $(".reply, #add-new-comment").show();
    $(".reply-form, #cancel").remove();
}

export class CommentData {
    constructor({ stack_uuid, comment }) {
        this.stackUUID = stack_uuid;
        this.body = comment;
        this.replies = [];
    }
}

export async function GetCommentDataAsync(postKey, profileUUID, offset = 0) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "/comment_handler.php",
            type: "POST",
            dataType: "json",
            data: {
                stack_command: "load_post_comments",
                offset,
                key: postKey,
                profile_uuid: profileUUID
            },
            success: json => {
                if (!json || !json.success || !Array.isArray(json.array)) {
                    resolve([]);
                    return;
                }

                resolve(json.array.map(c => new CommentData(c)));
            },
            error: xhr => reject(xhr.responseText)
        });
    });
}

export async function GetRepliesDataAsync(stackUUID, offset = 0) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "/comment_handler.php",
            type: "POST",
            dataType: "json",
            data: {
                stack_uuid: stackUUID,
                stack_command: "load_replies",
                offset
            },
            success: json => {
                if (!json || !json.success || !Array.isArray(json.array)) {
                    resolve([]);
                    return;
                }

                resolve(json.array.map(c => new CommentData(c)));
            },
            error: xhr => reject(xhr.responseText)
        });
    });
}

export async function LoadComments(postKey, profileUUID) {
    const $container = $("#comment-container");
    $container.empty();

    let comments = [];

    try {
        comments = await GetCommentDataAsync(postKey, profileUUID, 0);
    } catch (err) {
        console.error("Failed to load comments:", err);
        return;
    }

    comments.forEach(comment => {
        const $commentEl = $(RenderComment(comment));

        $commentEl.find(".load-replies").one("click", async function () {
            await LoadReplies(comment, $commentEl);
            $(this).remove();
        });

        $container.append($commentEl);
    });
}

export async function LoadReplies(comment, $commentEl) {
    let replies = [];

    try {
        replies = await GetRepliesDataAsync(comment.stackUUID, 0);
    } catch (err) {
        console.error("Failed to load replies:", err);
        return;
    }

    comment.replies.push(...replies);

    const $replyContainer = $commentEl.find(".loaded-replies");

    replies.forEach(reply => {
        const $replyEl = RenderComment(reply);
        $replyContainer.append($replyEl);
    });
}

export function CommentSection() {
    return /*html*/ `
        <div id="comment-section">
            <p id="comment-section-title" class="big-text">Comment section</p>

            <hr/>

            <form id="add-new-comment">
                ${UserMetadata(true)}
                <textarea id="comment-input" cols="100" name="comment" rows="5">Add a new comment...</textarea>

                <br/>

                <input type="submit" value="Submit" class="submit" />
            </form>

            <div id="comment-container">
                <!-- Comments here !-->
            </div>
        </div>
    `;
}

export function Folder() {
    return /*html*/ `
        <li class="folder">
            <img src={defaultImg} class="folder-thumbnail" />
            
            <p class="folder-name">Name</p>
              <div class="folder-icon-container">
                <img src={folderContentIcon} class="folder-icon" />
                <var title="The number of items in this folder" class="folder-content-count">-999</var>
              </div>
        </li>
    `;
}


export function RenderPost(post) {
    const title = post.title || "Untitled";
    const typeText = post.type ? post.type.charAt(0).toUpperCase() + post.type.slice(1) : "Unknown";

    switch (post.type) {
        case PostType.IMAGE:
            return /*html*/ `
                <a href="post/${post.key}" class="favorite-post" data-key="${post.key}">
                    <div class="favorite-post-type">${typeText}</div>
                    ${Image(post.src, post.title, post.key)}
                </a>
                
            `;
        case PostType.JOURNAL:
            return /*html*/ `
                <a href="post/${post.key}" class="favorite-post" data-key="${post.key}">
                    <div class="favorite-post-type">${typeText}</div>
                    ${Journal(post.body, post.key)}
                </a>
            `;
    }
}

export class ContentData {
    constructor({ key, title, type }) {
        this.key = key;
        this.title = title;
        this.type = type;
    }
}

export function LoadFavoritesDataAsync(profileUUID, offset = 0) {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: "/content_handler.php",
            type: "POST",
            dataType: "json",
            data: {
                offset,
                profile_uuid: profileUUID
            },
            success: json => {
                if (!json || !json.success || !Array.isArray(json.array)) {
                    resolve([]);
                    return;
                }

                resolve(json.array.map(c => new ContentData(c)));
            },
            error: xhr => reject(xhr.responseText)
        });
    });
}

export async function LoadFavorites(profileUUID) {
    const $container = $("#content-view");
    $container.empty();

    let posts = [];

    try {
        posts = await LoadFavoritesDataAsync(profileUUID, 0);
    } catch (err) {
        console.error("Failed to load comments:", err);
        return;
    }

    posts.forEach(post => {
        const $postEl = $(RenderPost(post));

        $container.append($postEl);
    });
}