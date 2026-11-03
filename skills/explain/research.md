# Why explain teaches the way it does

For people maintaining this skill: where each of its rules comes from. Most rest on research into how people learn
from explanations and from AI; some come from readers of these pages saying what they couldn't follow. Almost none of
the research studied developers reading about code, so the rules are a starting point to measure, not a proof.

| Rule | Where it comes from |
|---|---|
| One worked example, before and after side by side | Comparing concrete cases side by side, then naming the principle, helps people learn (d = 0.50 over 57 experiments; Alfieri 2013), as do worked examples generally (Atkinson 2000). |
| Questions that check the reading | People who only read an AI's explanation felt they understood and scored worse when tested later: students (Bastani 2025) and developers learning unfamiliar code (Shen & Tamkin 2026). Feeling one has learned and having learned differ (Deslauriers 2019). Answering questions beats re-reading (g 0.73 against 0.39; Rowland 2014). |
| Each answer says why | Answering helps only with feedback (Yang 2021), and feedback that explains carries over to new questions where the bare right answer doesn't (.45 against .30; Butler 2013). |
| Wrong options are what a skimmer would believe | A wrong pick then meets the exact misreading the feedback corrects (the review quiz's design, after Butler 2013). |
| Questions in the page, never behind a button | Help a learner has to ask for mostly goes unused: 17% of the moments it could have helped (Oreopoulos & Low 2026). Questions embedded in the text, with feedback linking back to the section, beat the plain text (78% against 67% retention; Learn Your Way 2025). |
| A note beside the box it is about | Explanations work better next to what they explain than in a separate list (Mayer 2017). |
| Short, focused charts | Simple, focused diagrams help; detailed flowcharts didn't (Shneiderman 1977; Butcher 2006). |
| Short text | Long, fluent answers hide their errors: readers missed them 39% of the time (Kabir 2024). |
| What matters most first; a reader may stop after any section | What comes first gets the attention (Fregnan 2022). Guidance helps newcomers and gets in experts' way (Tetzlaff 2025), so the top layer serves everyone and the detail waits below. |
| Where each fact comes from | Explanations make people accept an AI's answer whether it is right or wrong; they cut over-reliance only when they make checking cheaper (Bansal 2021; Vasconcelos 2023). Reviewers want the reason for a change most (Tao 2012), and a model pulls it out of a description poorly (precision 0.30; Pirouzkhah 2026), so whose reason it is must show. |
| The whole before the parts; every name explained; nothing that leans on another conversation | Readers of the first decision pages couldn't follow them: two tools appeared with no explanation, a "step 3" without its steps 1, 2 and 4, and no link to the pull request the work builds on. |
| Names on this page last, every mention linked to its line, with a way back | The reader of the first decision page asked for it. The long list no longer stands between the reader and the example (what comes first gets the attention; Fregnan 2022), and each line is one click from every place its name is used, not only the first (explanations work better next to what they explain; Mayer 2017). |
| Recommendation first, then the question | The reader's own rule for being asked to decide. |
| A hook holds a choice in the next-step box until a page is out; a go-ahead passes | The rule written down wasn't enough: over 11 days, 83 of 120 questions in the Claude app's next-step box came with no page since the reader's last message, some while a note of the rule said a chart in the chat would do. But holding every question cost a page of about four minutes for a yes on commit, a pull request or a fix already explained, or moved the question into the chat to dodge the hook. So a question with one reply button, or the app's own buttons and at most one reply, passes. The hook leaves AskUserQuestion alone, since skills ask with it one question after another. |
| The chat by default; a page for a choice | Since pages were drawn from data, an explain run took about 210 to 250 seconds, about 70% of it writing the page's data. An answer with nothing to choose reads as well in the chat with one case. |
| One "What you'd see" chart per thing a person does; questions right after it, each complete on its own | Readers of the plan pages: one combined chart for a complex change, and questions that leaned on names defined elsewhere, couldn't be followed without scrolling back. |
| Read it cold once, while the reader reads; what can't be answered goes under Still open | The writer knows the context and can't see what is missing; a reader with none can. It mirrors the blind subagent plan-check uses to question a plan. On the first decision page drawn with this skill, fourteen cold reads in a row each found something: the early rounds found false claims, contradictions and unexplained names; the late ones found details the decision didn't turn on, many raised by the longer answers to earlier rounds. On the second, a page covering three skills, eleven rounds cost about 830,000 tokens and 25 minutes, and each round's fixes raised the next round's questions. So the reading stops after one round, fixes only what is wrong or would change the decision, closes each gap in the fewest words, and a page asks one decision. The question is asked as soon as the page is shown, since the cold read took 15 to 70 seconds the reader spent waiting. |
| Premises proved from their source; what can't be proved says so | A cold read can't catch a wrong premise, since it reads only what the writer wrote, and a name that exists doesn't show that a case reaches it. |

## Sources

- Alfieri, Nokes-Malach, Schunn (2013). Learning through case comparisons: a meta-analytic review. *Educational Psychologist* 48(2). doi.org/10.1080/00461520.2013.775712
- Atkinson, Derry, Renkl, Wortham (2000). Learning from examples: instructional principles from the worked examples research. *Review of Educational Research* 70(2). doi.org/10.3102/00346543070002181
- Bansal et al. (2021). Does the whole exceed its parts? The effect of AI explanations on complementary team performance. *CHI '21*. arxiv.org/abs/2006.14779
- Bastani et al. (2025). Generative AI without guardrails can harm learning. *PNAS* 122(26). doi.org/10.1073/pnas.2422633122
- Butcher (2006). Learning from text with diagrams. *Journal of Educational Psychology* 98(1). doi.org/10.1037/0022-0663.98.1.182
- Butler, Godbole, Marsh (2013). Explanation feedback is better than correct answer feedback for promoting transfer of learning. *Journal of Educational Psychology* 105(2). doi.org/10.1037/a0031026
- Deslauriers et al. (2019). Measuring actual learning versus feeling of learning in response to being actively engaged in the classroom. *PNAS* 116(39). doi.org/10.1073/pnas.1821936116
- Elidan, Haramaty (2025). Towards an AI-Augmented Textbook. Google Research. arxiv.org/abs/2509.13348
- Fregnan et al. (2022). First come first served: the impact of file position on code review. *ESEC/FSE 2022*. arxiv.org/abs/2208.04259
- Kabir et al. (2024). Is Stack Overflow obsolete? An empirical study of the characteristics of ChatGPT answers to Stack Overflow questions. *CHI '24*. arxiv.org/abs/2308.02312
- Mayer (2017). Using multimedia for e-learning. *Journal of Computer Assisted Learning* 33(5). doi.org/10.1111/jcal.12197
- Oreopoulos, Low (2026). One click away: AI tutoring with Khanmigo in a two-year school experiment. NBER Working Paper 35620. nber.org/papers/w35620
- Pirouzkhah, Wurzel Gonçalves, Bacchelli (2026). The value of effective pull request description. *MSR '26*. arxiv.org/abs/2602.14611
- Rowland (2014). The effect of testing versus restudy on retention: a meta-analytic review of the testing effect. *Psychological Bulletin*. doi.org/10.1037/a0037559
- Shen, Tamkin (2026). How AI impacts skill formation. arxiv.org/abs/2601.20245
- Shneiderman, Mayer, McKay, Heller (1977). Experimental investigations of the utility of detailed flowcharts in programming. *Communications of the ACM* 20(6). doi.org/10.1145/359605.359610
- Tao, Dang, Xie, Zhang, Kim (2012). How do software engineers understand code changes? An exploratory study in industry. *FSE 2012*. doi.org/10.1145/2393596.2393656
- Tetzlaff, Simonsmeier, Peters, Brod (2025). A cornerstone of adaptivity: a meta-analysis of the expertise reversal effect. *Learning and Instruction* 98. doi.org/10.1016/j.learninstruc.2025.102142
- Vasconcelos et al. (2023). Explanations can reduce overreliance on AI systems during decision-making. *PACM HCI* 7 (CSCW1). arxiv.org/abs/2212.06823
- Yang, Luo, Vadillo, Yu, Shanks (2021). Testing (quizzing) boosts classroom learning: a systematic and meta-analytic review. *Psychological Bulletin*. doi.org/10.1037/bul0000309
