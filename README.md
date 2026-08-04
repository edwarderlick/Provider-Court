# Provider Court

An AI work marketplace where the judgment is real. Providers list a service, buyers pay for it, an AI generates the work, and GenLayer's own validators independently check whether it actually delivered on what was promised. Built on GenLayer Studio.

<img width="1919" height="868" alt="image" src="https://github.com/user-attachments/assets/d5202213-d248-4771-92db-5fbbdfbdacef" />

## The problem this is actually solving

Most "AI marketplace" ideas built on a blockchain fall into the same trap: the smart contract just stores a result that an off chain backend already decided. The chain becomes a receipt printer, not a judge. That's not really using the chain for anything except a database with extra steps.

Provider Court tries to avoid that trap on purpose. When a buyer pays for a generated image, a piece of text, or a spoken audio clip, the contract itself doesn't just take someone's word for whether the delivery was good. It fetches the actual delivered content and runs it through GenVM's real multi validator consensus, checking it against a small set of concrete, checkable clauses. If the delivery only partially satisfies what was promised, the buyer only pays partially. If there's a genuine disagreement, either side can appeal, and a second independent round of consensus resolves it.

That's the whole idea. Everything else in this repo exists to make that one sentence actually true, end to end, with real money moving and real validators deciding.

## What it actually looks like

<img width="1919" height="871" alt="image" src="https://github.com/user-attachments/assets/10aa333a-4ab1-4e48-9648-14ed95a48266" />

A provider lists what they offer in plain language: "I can generate anime style character art," "ask me anything, I'll write you a recipe," "I'll turn your topic into a short narrated voice clip." They set a price in test GEN. That's it. No form full of technical fields.

<img width="782" height="787" alt="image" src="https://github.com/user-attachments/assets/eb5aff4d-ba3d-41fb-b6fd-3e736ccf9fb8" />

Behind the scenes, the app turns that plain description into real, structured clauses the contract can actually check later. Every listing automatically gets a baseline clause confirming the delivered content genuinely is the right type (a real image, real text, real audio, not an error page or empty response). Text listings also get one or two real content clauses pulled from the description and, if the buyer adds their own request at checkout, from that too.

<img width="1189" height="740" alt="image" src="https://github.com/user-attachments/assets/04b6f0b2-f149-48ff-87dc-7bd689f75ec8" />
<img width="1165" height="792" alt="image" src="https://github.com/user-attachments/assets/bcc6bb50-4124-42cc-87fd-cd519164b096" />

Once a buyer pays, the pipeline runs on its own: the content gets generated, pinned to IPFS so anyone can independently fetch it, submitted to the contract, and adjudicated by GenVM. The buyer sees the real delivered artifact directly on the order page and a clause by clause breakdown of exactly what passed and what didn't, with the model's own reasoning for each one.

If they disagree with the outcome, they can appeal. That locks a bond and triggers a second, independent round of consensus on the same evidence. Whoever the re adjudication favors keeps their bond.

## Why the clauses are so plain

Earlier in building this, the app used to ask providers to fill out a technical clause form: pick a type, write a value, set a weight. It looked powerful and it was a mistake. Almost nobody writes a good clause by hand, and the form itself was the biggest barrier to anyone actually using the app.

The fix was to remove the form entirely and generate the clauses automatically from what people actually type in normal language. It also fixed a subtler bug: image and audio deliveries were briefly getting the same kind of text comprehension clauses as text orders, checking things like "does this mention Roronoa Zoro" against raw JPEG bytes decoded as if they were readable text. That can never pass, no matter how good the actual image is, because the check itself doesn't make sense for binary content. Image and audio orders now only get the baseline "is this genuinely the right kind of content" check. Text orders are the only ones that get real content clauses, because text is the one modality the current adjudication pipeline can genuinely reason about.

## Proof its working

Real orders during development have landed at outcomes like 57 percent released and 70 percent released, not just 0 or 100, because specific clauses genuinely failed while others genuinely passed. One early example: a buyer asked for a biryani recipe, got a real, complete recipe back, and one auto derived clause still failed because it was checking for the literal phrase "biryani recipe" rather than the actual content, which pushed the settlement to a partial release. That's a real, live example of GenVM disagreeing with a delivery on the merits, not agreeing with everything by default. It also directly led to fixing how clauses get generated so future ones check for substance instead of exact wording.

The appeal system has also been tested for real, not just written and assumed to work. A real order was disputed, locked a real bond, and moved into a Disputed state confirmed on chain. A separate appeal attempted after its window had already closed was correctly rejected by the contract with the exact reason why.

<img width="1199" height="780" alt="image" src="https://github.com/user-attachments/assets/1a52c834-6064-4fb7-8120-472482d90a60" />

There's also a piece of proof that lives outside this app's own Studio deployment entirely. Early in the project, the contract was deployed to GenLayer's Bradbury testnet, and a `register_provider` call reached full five out of five validator consensus there, confirmed independently through the explorer's own transaction history. Bradbury's own read path turned out to have an unrelated infrastructure bug at the time (reported upstream, not something in this contract's code), which is why active development moved to Studio. That Bradbury write is kept as historical evidence that this contract holds up under real decentralized consensus, not just a simulated one.

## How it's built

**Contract:** an Intelligent Contract written in Python for GenVM, holding the escrow state machine (Listed, Funded, Delivered, Adjudicating, Released, PartiallyReleased, Refunded, Disputed) and the `adjudicate` method that fetches a delivered artifact by its content address and checks it against a listing's clauses using GenVM's own equivalence principle for reaching validator consensus on subjective judgment calls.

**Generation:** text goes through Gemini, image and audio go through Cloudflare's Workers AI, and every delivered artifact gets pinned to IPFS through Pinata so validators can independently fetch the exact same content the buyer sees. This runs as part of the same Next.js app now, not a separate service, so there's one thing to run and one thing to deploy.

**Frontend:** Next.js, wired to GenLayer Studio through genlayer-js, with real wallet signing for every write a person makes (listing, purchasing, appealing, claiming). A small set of fixed accounts can sign on the app's behalf for local testing convenience only, off by default anywhere public.

**Identity versus infrastructure:** anyone can register as a provider with their own wallet, and that registration, reputation, and payout are genuinely decentralized. The actual generation still runs through this app's own shared API keys rather than each provider bringing their own model. That's a deliberate scope choice for now, not a limitation of GenLayer or the contract itself, and it's the first thing on the roadmap below.

## Where this goes next

This is the real roadmap, not a wish list dressed up as one.

**A genuine open marketplace of providers.** Right now every listing runs on the same shared backend regardless of who's registered as the provider. The real next step is letting a provider bring their own API key and their own model, so different listings can genuinely be powered by different providers competing on quality, speed, and price, the way the idea was meant to work from the start.

**Optional manual clauses for power users.** Auto generated clauses are the right default for almost everyone, but a provider who genuinely wants precise control over exactly what gets checked should be able to opt into writing their own clauses by hand, on top of the automatic baseline.

**A real public deployment.** The app has already been fully verified end to end, including a real merge into a single deployable project, and is ready to go live on a public URL. That step is coming immediately after this submission.

**Real music generation for audio listings**, once a genuinely free option exists, or as a paid opt in path clearly separated from the free tier the rest of the app depends on.

**Mainnet, once GenLayer's mainnet actually exists.** Everything here is built against the same GenVM primitives mainnet will use. Moving is a redeploy, not a rebuild.

## Running it locally

```
cd web
npm install
npm run build
npm run start
```

Copy `.env.example` to `.env.local` and fill in the real values: a GenLayer testnet RPC target, your Gemini and Cloudflare Workers AI keys, and a Pinata JWT for pinning. Everything runs as one app now, one server, one port.
