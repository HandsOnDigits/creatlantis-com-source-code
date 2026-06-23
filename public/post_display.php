<?php
  session_start();

  include_once("./config.php");
  include_once("./data_handler.php");
  include_once("./data_filter.php");

  $dh_read = new DataHandle($dbConfig, $s3Config, S3BotType::readOnly);
  $viewedPost = null;

  if(isset($_GET['key'])) {
    $key = $dh_read->getKeyFromShortUUID($_GET['key']);
    $postID = $dh_read->shortUUIDToPostID($_GET['key']);
    
    if($key) {
        $viewedPost = $dh_read->loadSingleFile($key);
        $decodedPostJSON = json_decode($viewedPost);
        $decodedPostJSON->metadata->owner->profile_image = $dh_read->GetURLOnSingleFile($decodedPostJSON->metadata->owner->profile_image);
        $viewedPost = json_encode($decodedPostJSON);

        $feedback = $dh_read->loadFeedbackOnSingleFile($postID);
        $feedbackJSON = json_encode($feedback);
    }
  }

  $_POST['key'] = $_GET['key'];
?>

<!DOCTYPE html>
<html>
    <head>
        <title>Post name</title>
        <?php include_once("./html_elements/head.html"); ?>
    </head>
    <body>
        <?php include_once("./setup.php"); ?>
        <?php include_once("./navigation_bar.php"); ?>
        
        <div id="post-display">
            <!-- Display the post here -->

            <div id="post-icon-container" hidden>
                <div class="vertical-hr"></div>

                <button id="delete">Delete</button>

                <button id="edit">Edit</button>

                <div class="vertical-hr"></div>
            </div>

            <p id="post-display-title" class="extra-big-text">Title</p>

            <div id="post-owner-info">
                <!-- Post owner info here -->
            </div>

            <div id="post-feedback">
                <div class="vertical-hr"></div>
                <div>
                    <div id="post-feedback-top">
                        <div id="star-rate-box">
                            <var title="The number of reviews on this post" id="star-rate-reviews-count">-100</var>
                            <div id="star-rateing" title="Rate this post from 1 to 5 stars" style={{ "--star-rating" : "50%" }}
                                class="feedback-icon">
                                <div id="rate-1-star" class="rate-star-element"></div>
                                <div id="rate-2-star" class="rate-star-element"></div>
                                <div id="rate-3-star" class="rate-star-element"></div>
                                <div id="rate-4-star" class="rate-star-element"></div>
                                <div id="rate-5-star" class="rate-star-element"></div>
                            </div>
                            <var title="The average of the star rates on this post" id="star-rate-average">-5</var>
                        </div>

                        <var id="fave-count" title="The count of users adding this post to there favorites">-100</var>
                        <img id="add-to-favorites" title="Add the post to your favorites" src="./images/icons/faveIcon.webp" class="feedback-icon"/>

                        <var id="view-count" title="The count of unique views">-100</var>
                        <img src="./images/icons/viewIcon.webp" class="feedback-icon"/>

                        <var id="comment-count" title="The count of comments on this post">-100</var>
                        <img src="./images/icons/commentIcon.webp" class="feedback-icon"/>
                    </div>

                    <div id="post-feedback-bottom">
                        <!-- Post reactions here -->
                    </div>
                </div>

                <div class="vertical-hr"></div>
            </div>
            
            <hr/>

            <div id="description">Description...</div>
        </div>
        
        <?php include_once("./html_elements/footer.html"); ?>

        <script type="module">
            import { 
                Image, 
                Journal, 
                PostType, 
                CommentSection, 
                LoadComments, 
                Profile,
                SetupReplyContainer, 
                DestroyReplyContainer 
            } from "./js/common.js";


            /* Load post data */
            <?php if($viewedPost != null): ?>
                let postData = JSON.parse(<?php echo json_encode($viewedPost); ?>);
                $(document).prop('title', postData.metadata.title);
                $("#post-display-title").html(postData.metadata.title);

                let $postContainer = $("#post-display");

                switch(postData.type) {
                    case PostType.IMAGE:
                        $postContainer.prepend(Image(postData.src));
                        $('#description').html(postData.metadata.description);
                        break;
                    case PostType.JOURNAL:
                        $("#post-display-title").remove();
                        $('#description').remove();
                        $postContainer.prepend(Journal(postData.body));
                        break;
                }

                /* Load owner info */

                $(document).ready(function () {
                    var profile = Profile(postData.metadata.owner.username, postData.metadata.owner.tagline, postData.metadata.owner.profile_image, postData.metadata.owner.profile_image);
                    $("#post-owner-info").append(profile);
                });
                
                /* Load comments and repies */

                $postContainer.append(CommentSection());

                $(document).on("click", ".reply", function () {
                    const $comment = $(this).closest(".comment");
                    SetupReplyContainer($comment);
                });

                $(document).ready(async function () {
                    await LoadComments("<?php echo $_GET['key']; ?>", null);
                });

                <?php if($feedback): ?>
                    /* Load feedback */
                    var rawData = <?php echo $feedbackJSON; ?>;

                    // Check if it's an array and take the first item, otherwise use it as is
                    var feedbackData = Array.isArray(rawData) ? rawData[0] : rawData;

                    var starRatePercentage = feedbackData.star_average * 20; // Convert to percentage (assuming star_average is out of 5)

                    $(document).ready(function () {
                        $("#star-rate-reviews-count").html(feedbackData.star_rate_reviews_count);
                        $("#star-rate-average").html(feedbackData.star_average); 
                        $("body").get(0).style.setProperty('--star-rating', starRatePercentage + '%');
                        $("#fave-count").html(feedbackData.fave_count);
                        $("#view-count").html(feedbackData.views_count);
                        $("#comment-count").html(<?php echo $dh_read->countCommentsOnSingleFile($_GET['key']); ?>);
                    });
                <?php endif; ?>

            <?php else: ?>
                $("#post-display").html(/*html*/ `
                    <div id="post-feedback">
                        <div>
                            <h1 class="extra-big-text">ERROR 404</h1>
                            <br/>
                            <p>Post could not be found... :/</p>
                        </div>
                    </div>
                `);
            <?php endif; ?>

            function PostReaction(emoji) {
                return /*html*/ `
                    <div class="post-reaction">
                        <var title="The count of this reaction" class="reaction-count">-5</var>
                        <p title="Add this reaction to this post" class="reaction-emoji">${emoji}</p>
                    </div>
                `;
            }
        </script>
    </body>
</html>