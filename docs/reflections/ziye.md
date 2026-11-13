# Reflection: Ziye Huang

Building LifeBoard with AI agents taught me that an agent is only as good as the context and the checks around it. AGENTS.md grew to 40 changelog entries, each tied to a mistake we found. When a rule was specific, such as integer cents or the leftover cent going to the payer, the agent followed it. When a rule was vague or missing, the agent picked a reasonable-looking default: it took a payment's paid time from the app server's clock (#121), the same mistake #75 had fixed a few days earlier.

The bugs that mattered most were found by people, not by the agent or the tests. Reading each other's pull requests found a settle-up that suggested a payment already made (#112), one that could get stuck (#108), and a deadlock between two SQL functions (#124). From the deadlock I learned to reproduce a failure before trusting a fix, first by hand with two database sessions and then as a test that fails on the old code. Test-first mattered beyond the grade: a failing test is the most precise way to tell an agent what done means.

As Scrum Master in Sprint 3, I saw the planning side. We committed 16 issues, and 9 more came up during the sprint, most of them from reviews. Writing open decisions into the pull request, instead of waiting for my partner across time zones, kept work moving, but I also learned to leave room in a plan for the follow-ups a careful review always produces.

Next time I would write a rule after the first bug, not the second, and put easy-to-forget rules, like adding new pages to the accessibility tests, on the review checklist.
