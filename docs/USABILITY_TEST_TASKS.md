# Usability Test: Tasks, Follow-up Questions and Closing

This is the main portion of the Crunch Week usability test script. It picks up right
after the background questions in `USABILITY_TEST_INTRO.md` (section 7) and runs to the
end of the session: the tasks, the follow-up questions after each one, the prompts for
when a participant goes quiet, the closing questions and the thank-you.

Each task is a goal a student would really have, read aloud by the facilitator. None of
them says where to tap. The scenarios come from the team's suggestions in #213 and the
"important user stories" list from that discussion.

**Status:** draft for the team to review.
**Written for:** issue #215.
**Setup, test accounts and the observation sheet:** issue #216.

---

## Session plan

| # | Task | User stories | Estimated time |
|---|------|--------------|----------------|
| – | Introduction and background questions (`USABILITY_TEST_INTRO.md`) | – | 8 min |
| 1 | Create an account and get into the app | US-19, US-20, US-42, US-47 | 5 min |
| 2 | Add one of your courses | US-22 | 4 min |
| 3 | Add that course's deadlines from its syllabus | US-28, US-29, US-30 | 6 min |
| 4 | Bring in your deadlines from your Moodle calendar *(optional)* | US-48, US-49 | 5 min |
| – | Switch to the prepared account | – | 1 min |
| 5 | Find your busiest week | US-01, US-04, US-05 | 4 min |
| 6 | Change an estimate, then finish an assignment | US-12, US-44, US-08, US-31, US-23 | 6 min |
| 7 | Change how much time you have | US-32 and its follow-up (#148) | 4 min |
| ★ | Bonus: when to start a big assignment *(only if time is left)* | US-14, US-15 | 3 min |
| – | Closing questions and thank-you | – | 5 min |

**Total:** about 43 minutes with Task 4, about 38 without it. The bonus task only runs
if the session is under 40 minutes when Task 7 ends.

The times are for the facilitator's planning only. The introduction tells participants
there is no time limit, so never mention them. If a participant is still working at
about twice the estimate, say "Thanks, that's really helpful. Let's move on to the next
one," and note it as not completed.

**If the session is running long,** skip Task 4 first, then the second part of Task 7.

**Order:** Tasks 1–4 follow a new student setting up their own semester, so each one
builds on the last. Tasks 5–7 need a full semester to be meaningful, so they use a
prepared account (see the switch below), and every participant sees the same data.

---

## Prompts for when the participant stops thinking aloud

Use these word for word, and only these. They keep the participant talking without
hinting at an answer. Wait about 10 seconds of silence before using one.

- "What are you thinking right now?"
- "What are you looking at?"
- "What are you trying to do?"
- "What do you expect to happen if you tap that?"
- "Is that what you expected?"
- "Keep telling me what's going through your head."

If the participant asks you a question ("Where do I go?", "Is this right?"), turn it
back without answering:

- "What would you do if I weren't here?"
- "Where would you expect to find it?"
- "What do you think?"

If the participant is stuck for about 2 minutes, give one small hint (for example, "Is
there anywhere you haven't looked yet?") and mark the task **with help**. Never say
"right" or "wrong"; say "Thanks" or "OK".

---

## Follow-up questions after every task

Ask these after each task, in this order, before moving on. Then ask the task's own
questions listed under it.

1. "What did you expect to happen when you selected that option?"
2. "Was there anything about this task that confused you?"
3. "What information would have made this task easier?"
4. "What would you change about this feature?"
5. "On a scale of 1 to 7, where 1 is very difficult and 7 is very easy, how easy was that task?"

If time is short, ask questions 2 and 5 only.

---

## Wording to listen for during every task (US-43)

This is not its own task. Throughout the session, the note-taker writes down any word the
participant pauses on, reads aloud with a question in their voice, or explains wrongly.
Pay special attention to:

- "Crunch week", "next heavy week" and "wall"
- "Hours you set aside each week" and the dashed line on the chart
- "X of your Y allocated hours" on Courses
- "Estimate", "Left to do" and "Worked on"
- "Absences allowed" and "Drop rule"

---

## Part 1: Setting up your own semester

The participant starts on the app's first screen, logged out, using the fresh test email
prepared for them (#216).

### Task 1: Create an account and get into the app

**Stories:** US-19, US-20, US-42, US-47. **Estimated time:** 5 minutes.

> "This is the first time you've opened Crunch Week. Get yourself into the app, to the
> point where you could start planning your semester. Your email for today is on this
> card."

When they are in:

> "Now imagine you've closed the app and come back later. Log out, then log back in, and
> this time type your password wrong once on purpose."

**The participant has succeeded when they:**
- Create an account, without trying to log in to an account that doesn't exist yet.
- Get past the welcome screens to their own (empty) semester.
- See the wrong-password message, fix it, and get back in.
- Find their semester the same as they left it.

**Watch for:**
- Whether they understand the difference between logging in and creating an account.
- Whether the wrong-password message is visible while the keyboard is still open (US-42),
  and whether it tells them what to fix.
- What they do with the welcome screens: read them, skim them, or skip them. Note
  roughly how long they take.
- On the empty semester: whether they understand the difference between adding their
  own course and trying the sample semester.

**Task questions:**
- "What did you expect to see right after you made your account?"
- "In your own words, what did the error message tell you?"

### Task 2: Add one of your courses

**Story:** US-22. **Estimated time:** 4 minutes.

> "Add one of the classes you're taking this semester."

**The participant has succeeded when they:**
- Find where to add a course.
- Find their class in the course search, or create it if it isn't there, and save it.
- Can point to the course in the app afterwards.

**Watch for:**
- Where they look first.
- Whether the difference between finding an existing course and creating a new one is
  clear.
- Whether they understand the message if the course code already exists and they are
  asked to join it.

**Task question:**
- "Was there anywhere else you expected to be able to do this?"

### Task 3: Add that course's deadlines from its syllabus

**Stories:** US-28, US-29, US-30. **Estimated time:** 6 minutes.

Hand the participant the device with the test syllabus PDF on it (#216).

> "Here's the syllabus for that class. Get its assignments into the app, and make sure
> that what goes in is correct."

If they add everything without looking at it:

> "How sure are you that everything it found is correct?"

**The participant has succeeded when they:**
- Find where to add a syllabus and upload the PDF.
- Look over the assignments the app found, including their weeks and hours.
- Fix or remove at least one wrong item (the test PDF has one on purpose).
- Add the assignments and find them afterwards on This week or the Forecast.

**Watch for:**
- Whether they check what was found or accept it all in one tap.
- Whether they can correct a wrong due week, and whether they find how to remove an item.
- How they read the grade weights and policies, which are shown "for your information"
  and not saved.
- How they react while the PDF is being read: patient, confused or worried that it froze.

**Task questions:**
- "How confident are you that what went in is right?"
- "Would you rather upload the PDF or paste the text? Why?"

### Task 4 (optional): Bring in your deadlines from your Moodle calendar

**Stories:** US-48, US-49. **Estimated time:** 5 minutes.

Only run this task if the participant has a Calvin Moodle account and is comfortable
using it. Their calendar link is private: never write it in the notes, and remove it
after the session.

> "Your friend told you Crunch Week can read your Moodle calendar. Connect yours, and add
> the deadlines you want."

If they ask where to get the link, answer: "Where would you look for it in Moodle?" Only
show them if they are stuck for 2 minutes, and mark the task **with help**.

**The participant has succeeded when they:**
- Find where in Crunch Week to paste the link, and save it.
- Review the events the app found, checking the course and week of each.
- Add the ones they want, leave out the rest, and find them in the app afterwards.

**Watch for:**
- Where they expect to paste a link (Courses, Forecast, a settings screen?).
- Whether they understand that the link is saved once and kept private.
- Whether they check each event or add everything, and what they do with events the app
  could not match to a course.

**Task question:**
- "What do you think happens if your professor changes a due date in Moodle later?"

---

## Switching to the prepared account

The facilitator logs out and logs in to the prepared account with the sample semester
loaded (#216).

> "For the next few tasks I've set up an account that already has a full semester of
> classes in it. Pretend it's your semester."

---

## Part 2: Planning with a full semester

### Task 5: Find your busiest week

**Stories:** US-01, US-04, US-05. **Estimated time:** 4 minutes.

> "Without using the This week screen, find out which week this semester is going to be
> the hardest for you, and tell me why."

Then:

> "Is there any week where you have more work than time? How can you tell?"

**The participant has succeeded when they:**
- Name the heaviest week from the Forecast.
- Say that it has more work than their hours, and point to how they know.
- Explain the chart in their own words. Tapping a week to see what's due is a bonus.

**Watch for:**
- Whether they understand the bars and the dashed line without help.
- Whether the "next heavy week" figure and the warning card make sense, and how they
  read the word "wall".
- Whether they try tapping a bar.

**Task questions:**
- "In your own words, what is this screen telling you?"
- "Would you do anything differently this semester because of it?"

### Task 6: Change an estimate, then finish an assignment

**Stories:** US-12, US-44, US-08, US-31, US-23. **Estimated time:** 6 minutes.

> "One of your assignments due this week is going to take longer than the app thinks.
> Change how long it will take."

Then:

> "You've just finished an assignment. Show that in the app, and tell it how long the
> assignment actually took you."

Then:

> "Oops, you marked the wrong one. Fix that."

**The participant has succeeded when they:**
- Change one assignment's hours and save it.
- Mark an assignment done and answer the question about how long it took (or skip it on
  purpose).
- Undo marking the wrong assignment done.
- Notice that the remaining work for the week went down.

**Watch for:**
- Whether they see the grey check marks as something to tap.
- Whether they notice the "how long did it take you?" question, understand why it's
  asked, and find it quick or annoying.
- Whether they open the assignment's details screen or change it from the list.
- Whether they notice the workload numbers change.

**Task question:**
- "What do you think the app does with the hours you told it?"

### Task 7: Change how much time you have

**Stories:** US-32 and its follow-up (#148). **Estimated time:** 4 minutes.

> "You can only spend about 12 hours a week on homework this semester. Tell the app."

Then:

> "You're going away for a weekend in week 9, so that week you'll only have about 5 hours.
> Tell the app that too, without changing your other weeks."

**The participant has succeeded when they:**
- Change their hours for every week to 12.
- Change only week 9 to 5 hours, leaving the other weeks at 12.
- Notice which weeks now have more work than time.

**Watch for:**
- Whether the place to change their hours is clear from the Forecast.
- Whether they understand the difference between changing every week and changing one
  week.
- Whether the chart changes the way they expect.

**Task question:**
- "Did the app change what you expected it to change?"

### Bonus task: When to start a big assignment

**Stories:** US-14, US-15. **Estimated time:** 3 minutes. Only if time is left.

> "You have a big project coming up. When should you start working on it so it doesn't
> pile up at the end?"

**The participant has succeeded when they:** find the app's suggestion of which
assignment to start and in which week, and explain it in their own words.

**Watch for:** whether they notice the suggestion, whether they understand that starting
early makes the busy week lighter, and whether they say they would trust it.

**Task question:**
- "Would you follow that suggestion? Why or why not?"

---

## Closing questions

> "That's all the tasks. Thanks for working through them. I just have a few last
> questions about the app as a whole."

1. "Overall, how would you describe Crunch Week to a friend?"
2. "What was the most confusing or frustrating part?"
3. "What did you like the most?"
4. "Were there any words or labels you didn't understand?"
5. "Was there anything you expected the app to do that it didn't?"
6. "If you could change one thing about the app, what would it be?"
7. "Would you use Crunch Week for your own classes? Why or why not?"
8. "Is there anything else you'd like to tell us?"

---

## Thank-you

> "That's everything. Thank you so much for your time today. Everything you said, and
> especially the places where you got stuck, shows us exactly what we need to fix. Your
> feedback is going to make Crunch Week easier for every student who uses it after you.
> Do you have any questions for us before you go?"

---

## Notes for the facilitator (do not read aloud)

- Give each task by reading the quoted text. Do not add directions, and do not name
  buttons or screens unless the task already does.
- After the session, log out of both accounts and remove the participant's Moodle link
  if they saved one.
- Within 10 minutes of the session ending, the facilitator and note-taker each write down
  the three biggest problems they saw.
