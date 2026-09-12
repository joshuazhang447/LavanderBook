# Tags, venue notes and custom questions — overview

*A proposal for how LavenderBook collects the right information about different kinds of
places. Nothing here is built yet. 11 September 2026.*

## The problem

Every place in LavenderBook is reviewed the same way: a friendliness rating out of five, a
bathroom question, and free text. That works for a café.

It does not work for a shelter. The things someone needs to know before going to a shelter
— is there a curfew, are pets allowed, is there a bed tonight, which door do I use — are
not things we ask, and there is nowhere to put the answers.

There are two separate gaps here, and it is worth naming them separately, because the rest
of this document is built on the difference:

1. **We can't ask the right questions.** The questions that matter at a shelter are not the
   ones that matter at a café, and we only have one set.
2. **We have no way to say what we already know.** When one of our organisers has confirmed
   that a shelter is open overnight and staffed, there is nowhere to write that down. It
   sits in someone's head or a spreadsheet.

## What we are proposing

### Tags

An administrator can search for any real place and label it — *shelter*, *hub*, and so on.
A place can carry more than one label. Tagging a place is what switches on everything else
below.

### Venue notes — what *we* know

Once a place is tagged, an administrator can open it and write a list of bullet points
about that specific place. As many as needed, in whatever order makes sense, dragged into
position by hand.

> **Le Prince Shawarma**
> - Open 24 hours, staffed overnight
> - Accessible entrance on the side door
> - Ask for Marie at reception

These are **statements LavenderBook is making**. An organiser writes them because we
confirmed them — we called, we visited, staff told us. They are unique to that one place.

### Custom questions — what *visitors* tell us

Each tag also owns a short list of questions, written and edited by administrators. Someone
reviewing a shelter is asked the shelter questions. Someone reviewing a café is not.

> *Is there a curfew?* — 11pm
> *Are pets allowed?* — No
> *Beds available tonight?* — 12

Because many people answer the same question, these **add up**: "nine of eleven people said
there is no curfew." One person's answer is an opinion; eleven is a pattern.

A question can be a yes/no, a number, a choice from a list, a short line of text, or a
sliding scale.

### The distinction, in one line

**Notes are what we assert. Answers are what visitors report.**

On a place's page they sit side by side but look clearly different, so a reader never has
to guess which they are looking at. That is a safety requirement, not a design preference:
"we confirmed this shelter is staffed overnight" and "some visitors thought it was staffed
overnight" are not the same claim and must not look the same.

### Changes happen immediately

Editing questions or notes takes effect straight away — no app release, no waiting on a
developer. The next person to open that place sees the change.

## One rule that may look inconsistent

**A question's wording can never be changed once people have answered it. A bullet point
can be edited freely, any time.**

That difference is deliberate.

A **question** is a container. If we edited "Is there step-free access?" into "Is there a
ramp?", every answer anyone had ever given would quietly start meaning something else. The
old answers would still be there, still counted, now attached to a question nobody actually
answered. So instead of overwriting it, we retire that question and start a new one. The old
answers stay attached to the old wording.

A **bullet point** is a statement we are making ourselves. Nothing is counted from it and
nothing depends on its previous wording. If it becomes wrong, the right thing to do is
simply correct it — and we record who changed it and when.

The rule costs us a little convenience on questions. It buys the thing the whole directory
depends on: when LavenderBook says twelve people reported no curfew, that is true.

## What administrators will be able to do

- Search any real place and tag it
- Open a tagged place and write, edit, reorder and remove its bullet points
- Create, rename, reorder and retire tags
- Write and edit the questions attached to each tag
- See, for any question, how people have actually answered it
- Work through a queue of every review, and hide or remove one

The admin panel grows from one section to four: **Users** (already built), **Venues**,
**Tags**, and **Reviews**.

## The review queue

Reviews appear in a single list with a fixed set of columns — place, author, rating, an
excerpt, its tags, and how many extra questions were answered. Clicking a review opens a
panel beside the list showing the whole thing, including every custom answer in the wording
it was asked under.

We deliberately are **not** spreading custom answers across the table as columns. Ten tags
with eight questions each would mean eighty possible columns, and the table would get worse
every time we added a tag. Keeping the list simple and the detail one click away means it
stays readable no matter how far this grows.

## Still to decide

**These three need an answer before work starts**, because they change how the thing is
built rather than how it looks:

1. **Are tags visible to the public?** Does a visitor see that a place is labelled
   *shelter*, or is that label only for us? This is a safety question, not a presentation
   one.
2. **If tags are hidden, are the bullet points still shown?** They are the genuinely useful
   content, so probably yes — but we should decide rather than assume.
3. **Free-text answers are visible to everyone the moment they are written**, exactly as
   review text is today. If any question should not work that way, we need to know which.

**These four can be settled as we go:**

4. When a tag is removed from a place, do the answers and bullets already there disappear,
   or stay? Our suggestion is to keep them and simply stop showing them.
5. Who can tag places and write bullets — every administrator, or a smaller group? A bullet
   point is LavenderBook speaking in its own voice.
6. Do we need a full history of what a bullet point said previously, or is "last edited by,
   on this date" enough?
7. Adding a new required question later leaves every earlier review incomplete. Do we chase
   those, or accept the gap?

## How it would be built

In six steps, each useful on its own:

1. Tags, and the ability to tag a place
2. **Bullet points** — writing and showing them
3. The question editor
4. Questions appearing in the app when someone writes a review
5. The review queue
6. Answer summaries under each tag

Step 2 is placed early on purpose. It is the smallest piece, it does not depend on any of
the question work, and it puts real organiser-written information in front of users before
the harder half of the project begins.

## One thing to flag

There is an existing quirk worth knowing about: **today a place only appears on the map
once somebody has reviewed it.** If we tag a shelter and write bullets for it, but nobody
has reviewed it yet, it would be invisible — which is the exact opposite of what this
feature is for. Fixing that is part of step 1 and is already accounted for.

---

*A detailed technical version of this proposal is in `docs/tag-system-design.md`.*
