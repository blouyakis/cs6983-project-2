# Reflection: Barbara Louyakis

The main thing LifeBoard taught me is that the rules file matters more than the prompt. For HW3 I ran issue #4, accounts and login, twice: once with our AGENTS.md and once without. Without it, the agent chose library defaults wherever the requirements were quiet: bcrypt cost 10, a seven-day cookie, Secure only in production, and the JWT returned in the response body. The code looked finished and passed its own tests. After that I treated AGENTS.md as part of the product. When a review found a mistake an agent could repeat, Ziye or I added a rule and a changelog line saying why.

Test-first commits were the second lesson. Committing the failing test before the code gave me a way to check the agent's work that did not depend on reading every line. It mattered most for money and concurrency, where the settle-up race fixes (#83, #86) each came with a database test that pins down how the race must end.

Partner review caught what tests and agents missed. Ziye's review of direct payments showed that a settle-up could suggest a payment someone had already made, which became #112. Reading the locks in Ziye's add_member change, I found a possible deadlock, which became #124. Neither bug had a failing test. Both came from one of us reading the other's reasoning.

What I would change is planning. Sprint 2 was too large, Sprint 1 had no planning notes, and the demo video and submission work landed in the last days. Applying migrations to the hosted database by hand was also fragile: one migration reached main a day before it reached production. Next time I would automate that step, and cap each sprint at what two people can review, not what two agents can write.
