document.addEventListener("DOMContentLoaded",
    function() {
        var komdiv, closeButton, loginlink, modal, overlay, guts, since
        var user = null;
        var isloggedin = false
        var fetchurl = "/kommentarer" + document.location.pathname
        var templates = {}

        function sweDate(datestring) {
            var d = new Date(Date.UTC(...datestring.split(/[-T:Z]/, 6)))
            var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
            return new Intl.DateTimeFormat('sv-SE', options).format(d);
        }

        function closeModal() {
            modal.classList.add("closed");
            overlay.classList.add("closed");
        }

        function openModal() {
            modal.classList.remove("closed");
            overlay.classList.remove("closed");
        }

        function setLoggedIn(loggedin) {
            isloggedin = loggedin;
            var li = document.querySelector("#loggedinstatus")
            var nli = document.querySelector("#nonloggedinstatus")
            var un = li.querySelector("#username")
            if (loggedin) {
                nli.classList.add("closed");
                li.classList.remove("closed");
                un.innerText = user.screenname + " (" + user.username + ")";
                document.querySelector("#maincommentform").classList.remove("closed");
                document.querySelectorAll("div.replylink").forEach(element => element.classList.remove("closed"));
            } else {
                nli.classList.remove("closed");
                li.classList.add("closed");
                un.innerText = ""
                document.querySelectorAll(".commentform").forEach(element => element.classList.add("closed"));
                document.querySelectorAll("div.replylink").forEach(element => element.classList.add("closed"));
            }
        }

        function insertComments(comments) {
            var commenttree
            if (comments) {
                for (let comment of comments) {
                    var nc = insertComment(comment, commenttree)

                    if (!commenttree) {
                        commenttree = nc
                    }

                    if (comment.children) {
                        for (let child of comment.children) {
                            insertChildComment(child, commenttree.lastElementChild)
                        }
                    }
                }
                komdiv.querySelector("#comments").appendChild(commenttree);

            }

        }

        function replaceModalContent(newcontent) {
            while (oldchild = guts.firstChild) {
                guts.removeChild(oldchild)
            }
            frag = (newcontent instanceof DocumentFragment) ? newcontent : document.createRange().createContextualFragment(newcontent);
            guts.appendChild(frag)
        }

        function doServerAction(action, resultfunc, form = null, args = null) {
            formData = (form === null) ? new FormData() : new FormData(form);
            formData.append("action", action)
            if (args) {
                for (var key in args) {
                    formData.append(key, args[key])
                }
            }
            fetch(fetchurl, {
                credentials: 'same-origin',
                method: 'POST',
                body: formData
            }).then(response => response.json()).then(resultfunc)
        }


        function openRegisterNew() {
            t = templates['new-account-form-template'].cloneNode(true)
            replaceModalContent(t)

            function validateInput(event) {
                var messages = {
                    'screenname': "Visningsnamn måste vara minst 2 och max 30 tecken, får bara innehålla bokstäver, siffror, apostrof och mellanrum. Du får inte heller ha flera mellanrum i följd.",
                    'username': "Användarnamn måste vara minst 4 och max 30 tecken och får bara innehålla bokstäver, siffror, och _, inga mellanrum",
                    'email': "Det där verkar inte vara en giltig mejladress.",
                    'pwd': "Lösenord måste vara minst 5 tecken.",
                    'pwd2': "Lösenorden matchar inte!"
                }
                event.target.setCustomValidity("");
                if (!event.target.checkValidity() ||
                    (event.target.id == "pwd2" &&
                        event.target.value != guts.querySelector("#pwd").value)) {
                    event.target.setCustomValidity(messages[event.target.id])
                }
            }
            guts.querySelectorAll("input").forEach(function(i) {
                i.addEventListener("change", validateInput)
            })
            form = guts.querySelector("form")
            form.addEventListener("submit", function(event) {
                doServerAction("newaccount",
                    function(content) {
                        replaceModalContent(content.html);
                    }, event.target)
                event.preventDefault();
            })
            openModal();
        }

        function openLogin() {
            var t = templates['login-template'].cloneNode(true)
            replaceModalContent(t);
            guts.querySelector("form").addEventListener("submit", function(event) {
                doServerAction("login",
                    function(content) {

                        if (!content.hasOwnProperty("user")) {
                            replaceModalContent(content.html);
                            return;
                        }
                        user = content.user;
                        setLoggedIn(true);
                        closeModal();
                    }, event.target)
                event.preventDefault();
            })
            openModal();
        }

        function insertComment(comment, container) {
            var ct = templates['comment-template']
            var nc = ct.cloneNode(true)
            nc.querySelector(".author").innerText = comment.screenname
            nc.querySelector(".author").setAttribute("username", comment.username)
            nc.querySelector(".commenttext").innerText = comment.content
            nc.querySelector(".commenttime").innerText = sweDate(comment.created)
            nc.querySelector("article").id = "comment-" + comment.id
            nc.querySelector("form").name = "answer-form-" + comment.id
            nc.querySelector("input").value = comment.id
            nc.querySelector("form").addEventListener("submit", newComment)
            nc.querySelector("a.replylink").addEventListener("click", function(event) {
                var co = document.querySelector("#comment-" + comment.id)
                co.querySelector("#comment-" + comment.id + " div.replylink").classList.add("closed");
                co.querySelector("form").classList.remove("closed");
                co.querySelector("form textarea").focus()
            })
            if (isloggedin) {
                nc.querySelector("div.replylink").classList.remove("closed");
            }
            if (container) {
                container.appendChild(nc)
            }
            return nc
        }

        function insertChildComment(child, parent) {
            var cct = templates['child-comment-template']
            var ch = cct.cloneNode(true)
            ch.querySelector(".author").innerText = child.screenname
            ch.querySelector(".author").setAttribute("username", child.username)
            ch.querySelector(".commenttext").innerText = child.content
            ch.querySelector(".commenttime").innerText = sweDate(child.created)
            ch.querySelector("article").id = "comment-" + child.id
            parent.querySelector(".replies").appendChild(ch)
        }

        function newComment(event) {
            var f = event.target
            doServerAction("newcomment",
                function(result) {
                    if (result.hasOwnProperty("before")) {
                        since = result.before
                    }
                    if (result.hasOwnProperty("comments")) {
                        for (var comment of result.comments) {
                            if (comment.parent) {
                                var parent = document.querySelector("#comment-" + comment.parent)
                                insertChildComment(comment, parent)
                            } else {
                                insertComment(comment, document.querySelector("#comments"))
                            }
                        }
                    }
                    // add the comment to the list...
                }, f, { "since": since, })
            f.querySelector("textarea").value = ""
            f.querySelector("pre span").innerText = "";
            pf = f.parentNode
            if (pf && pf.classList.contains("comment")) {
                f.classList.add("closed")
                pf.querySelector("div.replylink").classList.remove("closed")

            }
            event.preventDefault()
        }

        function setup_ui() {
            komdiv = document.getElementById("komgo")
            document.getElementById("komgo").appendChild(templates['comment-status-template']);
            document.querySelector(".commentform").addEventListener("submit", newComment);
            document.body.appendChild(templates['modal-template'])

            closeButton = document.getElementById("close-button")
            loginlink = document.getElementById("loginlink")
            modal = document.getElementById("modal")
            overlay = document.getElementById("modal-overlay")
            guts = document.getElementById("modal-guts")

            closeButton.addEventListener("click", closeModal);
            loginlink.addEventListener("click", openModal);
            document.querySelector('#newaccountlink').addEventListener("click", openRegisterNew);
            document.querySelector('#loginlink').addEventListener("click", openLogin);
            document.querySelector('#logoutlink').addEventListener("click", function(event) {
                doServerAction("logout", function(content) {
                    setLoggedIn(false);
                })
            })
        }

        function get_comments() {
            fetch(fetchurl, {
                'credentials': 'same-origin',
            }).then(response => response.json()).then(function(result) {

                if (result.hasOwnProperty("user")) {
                    user = result.user;
                    setLoggedIn(true);
                } else { setLoggedIn(false) }
                if (result.hasOwnProperty("before")) {
                    since = result.before
                }
                if (result.hasOwnProperty("comments")) {
                    insertComments(result.comments)
                }
            })
        }


        function setuptemplates() {
            return fetch('/komgo/komgotemplates.html').then(response => response.text()).then(function(text) {
                var parser = new DOMParser();
                var doc = parser.parseFromString(text, "text/html");
                doc.querySelectorAll("template").forEach(function(t) {
                    t.parentNode.removeChild(t)
                    templates[t.id] = t.content
                })
            })
        }

        setuptemplates()
            .then(result => setup_ui())
            .then(result => get_comments())

        document.addEventListener("keyup", function(e) {
            if ("tagName" in e.target && e.target.tagName == "TEXTAREA") {
                e.target.parentElement.querySelector("pre span").innerText =
                    e.target.value;
            }
        })
    })
