<?php
  session_start();

  include_once("./user_classes.php");
  include_once("./config.php");
  include_once("./data_handler.php");

  $dh = new DataHandle($dbConfig, $s3Config, S3BotType::readOnly);
  
  $viewedUser = $dh->getUserInfo($_GET["username"]);

  $viewedUserProfileImage = $dh->GetURLOnSingleFile($viewedUser->profileImage());
  $viewedUserUsername = $viewedUser->username();
  
  $_SESSION["viewed_user"] = $viewedUser->uuid();
  
  $profileDesign = $dh->GetBodyAsStringOnSingleFile($viewedUser->uuid() . "/profile_design.json");

  $areYouTheViewedUser = false;
  
  if(isset($_SESSION["user_data"]))
    $areYouTheViewedUser = ($viewedUser->uuid() == unserialize($_SESSION["user_data"])->uuid());

?>

<!DOCTYPE html>
<html>
    <head>
        <title><?php echo $viewedUserUsername; ?></title>
        <?php include_once("./html_elements/head.html"); ?>
        <script type="module" src="./js/profile.js"></script>
    </head>
    <body>
        <?php include_once("./navigation_bar.php"); ?>
        <?php include_once("./setup.php"); ?>

        <div id="profile-container">
            <div id="content-map">
                <div id="content-map-left-part">
                    <!-- User metadata here -->

                    <div id="nav-tabs" alt="Profile navigation tabs">
                        <span id="show-profile" href="" class="tab">Profile</span>
                        <span id="show-gallery" href="" class="tab">Gallery</span>
                        <span id="show-faves" href="" class="tab">Favorites</span>
                        <span id="show-journals" href="" class="tab">Journals</span>
                    </div>

                    <button id="watch-user" title="Start watching this user" class="">Watch</button>
                </div>

                <div id="content-map-right-part">
                    <img src="./images/icons/editProfileIcon.webp" id="start-editing-profile" title="Start editing your profile page layout" alt="Edit profil icon" class="navigation-icon"/>
                </div>
            </div>

            <div id="short-user-description">
                <label>Date of birth:</label>
                <time id="date-of-birth">0000-01-01</time>
                <label>Gender:</label>
                <span id="gender">Non-binary</span>
                <label>Land:</label>
                <span id="land">Denmark</span>
            </div>

            <!-- Custom profile view here -->

        </div>
        
        <script type="module">
            import { LoadFavorites, Profile } from "./js/common.js";
            import { 
                LoadProfileElements, 
                BeforeStartEditingProfileElement, 
                SaveSingleElement, 
                StartEditingProfileLayout, 
                ElementType, 
                EndEditingProfileLayout, 
                CustomProfileView, 
                CustomProfileEdit, 
                CustomProfileElement, 
                CommentSectionElement, 
                PostSpotlightElement, 
                ProfileBIOElement 
            } from "./js/profile.js";
            
            /* Load in profile elements */

            // Default profile design
            let profileDesignJSON = { 
                background: { image: "", styling: "" }, 
                elements: { 
                    left: [ new CustomProfileElement() ],
                    right: [
                        new ProfileBIOElement(),
                        new CommentSectionElement()
                    ]
                }
            };

            <?php 
                if(isset($profileDesign)) {
                    $decodedJSON = json_decode($profileDesign);
                    
                    $backgroundImage = $decodedJSON->background->image;
                    $backgroundStyle = $decodedJSON->background->styling;

                    $left = json_encode($decodedJSON->elements->left);
                    $right = json_encode($decodedJSON->elements->right);

                    echo "profileDesignJSON = { 
                        background: { image: '$backgroundImage', styling: '$backgroundStyle' }, 
                        elements: { 
                            left: $left,
                            right: $right
                        }
                    }";
                }
            ?>

            $("#profile-container").append(CustomProfileView());
            $("#profile-container").append(CustomProfileEdit());

            $(document).ready(function() {
                LoadProfileElements(profileDesignJSON);
                BeforeStartEditingProfileElement(true);
            })
            
            // Start editing profile layout
            $("#start-editing-profile").click(function() {
                StartEditingProfileLayout(profileDesignJSON);
            });

            // End editing profile layout
            $("#profile-layout-icon-container button").click(function() {
                EndEditingProfileLayout(this, true, profileDesignJSON);
            });

            $(".custom-profile-editor").hide();

            /* Load in viewed user metadata */

            var profile = Profile("<?php echo $viewedUserUsername; ?>", "<?php echo $viewedUser->tagline(); ?>", "<?php echo $viewedUserProfileImage; ?>");

            $("#content-map-left-part").prepend(profile);

            /* Load selected profile tap */
            switch ("<?php echo $_GET["tab"]; ?>") {
                case "profile":
                    $("#custom-profile-view").show();

                    $("#date-of-birth").text("<?php echo $viewedUser->dateOfBirth(); ?>");
                    $("#gender").text("<?php echo $viewedUser->gender(); ?>");
                    $("#land").text("<?php echo $viewedUser->land(); ?>");

                    $("#show-profile").addClass("selected-nav-tab");
                    break;
                case "gallery":
                    $("#custom-profile-view").hide();


                    $("#profile-container").append(Gallery());

                    $("#short-user-description").hide();

                    $("#show-gallery").addClass("selected-nav-tab");
                    break;
                case "faves":
                    $("#custom-profile-view").hide();

                    $("#profile-container").append(Favorites());

                    $("#short-user-description").hide();

                    $("#show-faves").addClass("selected-nav-tab");
                    break;
                case "journals":
                    $("#custom-profile-view").hide();

                    $("#profile-container").append(Journals());

                    $("#short-user-description").hide();

                    $("#show-journals").addClass("selected-nav-tab");
                    break;
            }

            /* Profile nav taps */

            $(".tab").click(function() {
                if ($(this).is("[id*='show-profile']"))
                    window.location.href = window.location.origin + "/profile/<?php echo $viewedUserUsername; ?>";
                else if ($(this).is("[id*='show-gallery']"))
                    window.location.href = window.location.origin + "/profile/<?php echo $viewedUserUsername; ?>/gallery";
                else if ($(this).is("[id*='show-faves']"))
                    window.location.href = window.location.origin + "/profile/<?php echo $viewedUserUsername; ?>/faves";
                else if ($(this).is("[id*='show-journals']"))
                    window.location.href = window.location.origin + "/profile/<?php echo $viewedUserUsername; ?>/journals";
            });

            /* Load user date in profile elements */
            $(document).ready(function() {
                <?php if(!$areYouTheViewedUser): ?>
                    $("#start-editing-profile").remove();
                    $(".profile-element-icon-container").remove();
                <?php endif; ?>

                $(".bio-content-box .extra-big-text").text("<?php echo $viewedUserUsername; ?>");
                $(".bio-content-box .user-icon").attr("src", "<?php echo $viewedUserProfileImage; ?>");
                $("#hobbies").text("<?php echo $viewedUser->hobbies(); ?>");
                $('#user-bio').html("<?php echo convertQuotesToUnicode($viewedUser->biography()); ?>");
            });

            /* Other functions */

            function Gallery() {
                return /*html*/ `
                    <div id="gallery">
                        <div id="folder-map">
                            <ol id="folder-filter-list">
                                <li class="selected-folder-filter">filter</li>
                                <li class="">filter</li>
                                <li class="">filter</li>
                            </ol>

                            <br/>

                            <ol id="folder-list">
                                <!-- Folder list here -->
                            </ol>
                        </div>

                        <div id="selected-folder-content-box">
                            <div id="selected-folder-metadata">
                            <p id="selected-folder-name"> Selected folder</p>
                            <var id="selected-folder-content-count" title="The number of items in the selected folder">-999</var>
                            ▼
                            </div>

                            <div id="selected-folder-content">
                                <!-- Selected folder content here -->
                            </div>
                        </div>
                    </div>
                    `;
            }

            function Favorites() {
                $(document).ready(async function () {
                    await LoadFavorites("<?php echo $viewedUser->uuid();?>");
                });

                return /*html*/ `
                    <div id="content-view">
                        <!-- Favorites here -->
                    </div>
                    `;
            }

            function Journals() {
                return /*html*/ `
                    <div id="content-view">
                        <!-- Journals here -->
                    </div>
                    `;
            }
        </script>

        <?php include_once("./html_elements/footer.html"); ?>
    </body>
</html>