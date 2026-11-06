# EOS first-use usability pilot

## Goal

Find where a developer new to EOS gets stuck while installing it, inspecting a Git repository, and understanding what the inspection does. This is a small formative study, not a statistically representative launch survey.

## Participants and setup

- Invite five developers who have not used EOS. Include at least one person who is comfortable in a terminal but unfamiliar with EOS; record operating systems so Windows, macOS, and Linux friction is visible.
- Use a disposable sample Git repository with a clean named branch. Do not use production repositories, credentials, or personal source code.
- Ask the participant to share their screen only if they agree. Do not record or retain source code, credentials, or unrelated personal information.
- Give the participant the public landing page and say: “Use EOS to inspect this repository and prepare a plan for a small change. Tell me what you expect before you click or run each command.” Do not explain the navigation first.

## Observe these tasks

1. Identify what EOS can do and whether the website executes commands on the participant's machine.
2. Find the install instructions and copy the setup commands.
3. Run `flow inspect` against the sample repository and explain whether it changed files.
4. Create a `flow plan` and explain what it did and did not verify.
5. Find the requirements for isolated validation and identify what approval is needed before applying a diff.

Do not help during the first attempt. If the participant asks for help or makes an incorrect assumption, note the exact point and then help them recover; never ask them to run a destructive or production command.

## Record

For each task, record only:

| Measure | Record |
|---|---|
| Completion | Completed independently / completed with help / not completed |
| Time to first useful result | Minutes from opening the page to a successful local `flow inspect` |
| Errors and recovery | The error, whether the UI/documentation explained it, and whether the participant recovered |
| Confidence | “How sure are you about what this command changed?” from 1 to 5 |
| Clarity | “How clear was the next step?” from 1 to 5 |

Capture observations without names or repository content. Do not combine these responses into a product rating or claim broad usability from five sessions.

## Iteration gate

Before widening access, target at least four of five participants completing installation and read-only inspection without help, all five correctly understanding that the web page does not run commands and that `inspect` is read-only, and zero unresolved critical misunderstandings about `validate`, `apply`, or the approval hash. Treat any security-boundary misunderstanding as a blocking design issue. Re-run the same tasks after the next material onboarding change and compare observations; these thresholds are qualitative release criteria, not statistical proof.

## Limits of current evidence

The landing-page guard checks markup and selected accessibility/usability invariants. It does not measure task completion, time, satisfaction, Core Web Vitals in a browser, or WCAG conformance. EOS has not passed this pilot until sessions are conducted and results are reviewed.
