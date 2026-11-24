import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { SEEDED } from './helpers/auth';
import { FARMER_CHAT_MENU, JOURNEY, MY_OFFICER_MENU, apiAs, daysFromNow, expectImagesLoaded, openMenu, pngPhoto, signedIn } from './helpers/journey';

/**
 * One season between an extension officer and a farmer, end to end against the
 * real backend, database and file storage — each person in their own browser:
 *
 *  1. The farmer opens the conversation: describes the farm and crops, then
 *     sends photos of the problem.
 *  2. The officer reads it, sees the photos, replies with questions and a
 *     reference photo; the farmer answers with what they have done so far.
 *  3. The officer schedules an assessment visit and a training session over
 *     the coming weeks, and tells the farmer in the chat.
 *  4. On the farm, the officer files the visit report — findings, actions,
 *     time on farm, photos — and books the follow-up visit from it.
 *  5. The officer records progress: a success, a failure with a photo, a
 *     field event, an action taken and an observation; and the result of the
 *     advice given.
 *  6. The farmer sees the visits, the follow-up and the officer's messages;
 *     a message with a typo is corrected within the edit window.
 */
/** Attached photos (not icons) inside a message or entry. */
const PHOTOS = 'img[alt^="Photo"]';

test.describe.serial('officer and farmer through a season', () => {
  test.setTimeout(180_000);

  let farmerContext: BrowserContext;
  let farmerPage: Page;
  let officerContext: BrowserContext;
  let officerPage: Page;

  const farmDescription =
    'Hello officer, this is Mary in Bahati. I have 1.2 ha: maize on most of it, beans on 0.3 ha. ' +
    'Planted maize on 2 October with DAP, weeded once.';
  const problemCaption = 'Lower maize leaves are turning yellow from the tip. Photos attached.';
  const officerQuestion = 'Thank you Mary. Is the yellowing on the oldest leaves only, and did you top-dress with CAN yet?';
  const farmerAnswer = 'Only the old leaves. No top-dressing yet, I was waiting for the rains.';
  const visitNote = 'Assess nitrogen deficiency and check bean plot drainage';

  test.beforeAll(async ({ browser }) => {
    ({ context: farmerContext, page: farmerPage } = await signedIn(browser, JOURNEY.farmer.email));
    ({ context: officerContext, page: officerPage } = await signedIn(browser, SEEDED.officerNakuru));
  });

  test.afterAll(async () => {
    await farmerContext?.close();
    await officerContext?.close();
  });

  test('the farmer starts the conversation, describes the farm and sends photos', async () => {
    await openMenu(farmerPage, MY_OFFICER_MENU);
    await expect(farmerPage.getByRole('heading', { name: 'My extension officer' })).toBeVisible();

    const composer = farmerPage.getByLabel('Message to your officer');
    await composer.fill(farmDescription);
    await farmerPage.getByRole('button', { name: 'Send message' }).click();
    await expect(farmerPage.getByRole('group', { name: 'You message' }).filter({ hasText: 'Bahati' })).toBeVisible();

    // Two photos with a caption, as one message.
    await composer.fill(problemCaption);
    await farmerPage.getByTestId('chat-photo-input').setInputFiles([
      pngPhoto('yellow-leaf-1.png', [196, 180, 60]),
      pngPhoto('yellow-leaf-2.png', [180, 170, 70]),
    ]);
    const photoMessage = farmerPage.getByRole('group', { name: 'You message' }).filter({ hasText: problemCaption });
    await expect(photoMessage).toBeVisible();
    await expectImagesLoaded(photoMessage.locator(PHOTOS));
    await expect(photoMessage.locator(PHOTOS)).toHaveCount(2);
  });

  test('the officer sees the message and photos, replies with questions and a reference photo', async () => {
    await openMenu(officerPage, FARMER_CHAT_MENU);
    await officerPage.getByRole('button', { name: new RegExp(JOURNEY.farmer.name) }).first().click();

    const fromFarmer = officerPage.getByRole('group', { name: 'Farmer message' });
    await expect(fromFarmer.filter({ hasText: 'Bahati' })).toBeVisible();
    const withPhotos = fromFarmer.filter({ hasText: problemCaption });
    await expectImagesLoaded(withPhotos.locator(PHOTOS));

    const composer = officerPage.getByLabel('Message to the farmer');
    await composer.fill(officerQuestion);
    await officerPage.getByRole('button', { name: 'Send message' }).click();
    await expect(officerPage.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'top-dress with CAN' })).toBeVisible();

    await composer.fill('This is what a nitrogen-deficient leaf looks like: a yellow V from the tip.');
    await officerPage.getByTestId('chat-photo-input').setInputFiles([pngPhoto('reference-n-deficiency.png', [210, 200, 40])]);
    const reference = officerPage.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'yellow V' });
    await expectImagesLoaded(reference.locator(PHOTOS));
  });

  test('the farmer reads the reply and answers with what has been done', async () => {
    await farmerPage.reload();
    await openMenu(farmerPage, MY_OFFICER_MENU);
    const fromOfficer = farmerPage.getByRole('group', { name: 'Officer message' });
    await expect(fromOfficer.filter({ hasText: 'top-dress with CAN' })).toBeVisible();
    await expectImagesLoaded(fromOfficer.filter({ hasText: 'yellow V' }).locator(PHOTOS));

    await farmerPage.getByLabel('Message to your officer').fill(farmerAnswer);
    await farmerPage.getByRole('button', { name: 'Send message' }).click();
    await expect(farmerPage.getByRole('group', { name: 'You message' }).filter({ hasText: 'waiting for the rains' })).toBeVisible();
  });

  test('the officer schedules an assessment and a training session, and tells the farmer', async () => {
    const assessment = daysFromNow(2);
    const training = daysFromNow(21);

    await openMenu(officerPage, 'Visits');
    for (const visit of [
      { type: 'Farm assessment', when: assessment.dateTimeLocal, note: visitNote },
      { type: 'Training', when: training.dateTimeLocal, note: 'Demonstrate CAN top-dressing rates and timing' },
    ]) {
      await officerPage.getByRole('button', { name: /Schedule.*Visit/i }).first().click();
      const form = officerPage.locator('form', { has: officerPage.getByLabel('Search farmer') });
      await form.getByLabel('Search farmer').fill('Mary');
      await form.getByRole('button', { name: new RegExp(JOURNEY.farmer.name) }).click();
      await form.getByRole('button', { name: visit.type, exact: true }).click();
      await form.getByLabel('Visit date and time').fill(visit.when);
      await form.getByLabel('Visit notes').fill(visit.note);
      await form.getByRole('button', { name: 'Schedule visit' }).click();
      await expect(officerPage.getByLabel('Search farmer')).toHaveCount(0);
    }
    await expect(officerPage.getByText(visitNote)).toBeVisible();

    // Correspondence: the officer confirms the dates in the thread.
    await openMenu(officerPage, FARMER_CHAT_MENU);
    await officerPage.getByRole('button', { name: new RegExp(JOURNEY.farmer.name) }).first().click();
    await officerPage.getByLabel('Message to the farmer').fill(
      `I will visit on ${assessment.date} at 9:00 to assess the maize, and run a top-dressing session on ${training.date}.`
    );
    await officerPage.getByRole('button', { name: 'Send message' }).click();
    await expect(officerPage.getByRole('group', { name: 'Officer message' }).filter({ hasText: assessment.date })).toBeVisible();
  });

  test('on the farm, the officer files the visit report and books the follow-up from it', async () => {
    const followUp = daysFromNow(16);
    await openMenu(officerPage, 'Visits');
    await officerPage.getByRole('button', { name: `Complete (${JOURNEY.farmer.name})` }).first().click();

    const report = officerPage.getByRole('dialog', { name: new RegExp(`Visit report: ${JOURNEY.farmer.name}`) });
    await report.getByLabel('Findings *').fill('Nitrogen deficiency on lower leaves across the maize; beans waterlogged in the lower corner.');
    await report.getByLabel('Actions taken and advice given').fill('Advised CAN top-dressing at 50 kg/acre after the next rain; dug a drainage furrow with the farmer.');
    await report.getByLabel('Time on farm (minutes)').fill('55');
    await report.getByLabel('Photos (up to 4)').setInputFiles([pngPhoto('field-maize.png'), pngPhoto('field-beans.png', [90, 110, 60])]);
    await report.getByLabel('Follow up by').fill(followUp.date);
    await report.getByRole('button', { name: 'Complete visit' }).click();
    await expect(report).toHaveCount(0);

    // The report is on the completed visit, and the follow-up visit is booked.
    await officerPage.getByRole('button', { name: /Completed/ }).first().click();
    await expect(officerPage.getByText(/Findings:.*Nitrogen deficiency/)).toBeVisible();
    await expect(officerPage.getByText(/Follow-up by/)).toBeVisible();

    const officer = await apiAs(officerPage.request, SEEDED.officerNakuru);
    const visits = (await (await officer.get(`/api/v1/visits?farmerId=${JOURNEY.farmer.id}`)).json()) as {
      data: { visits: Array<{ id: string; status: string; visitType?: string; visit_type?: string; followUpDate?: string | null; outcomes?: string | null }> };
    };
    const done = visits.data.visits.find(v => v.status === 'completed');
    expect(done?.followUpDate).toBe(followUp.date);
    const types = visits.data.visits.map(v => v.visitType ?? v.visit_type);
    expect(types).toEqual(expect.arrayContaining(['assessment', 'training', 'follow_up']));

    // The report's photos are stored with the visit and readable by the officer.
    const detail = (await (await officer.get(`/api/v1/visits/${done!.id}`)).json()) as { data: { attachments: Array<{ url: string }> } };
    expect(detail.data.attachments).toHaveLength(2);
    expect((await officerPage.request.get(detail.data.attachments[0].url)).status()).toBe(200);
  });

  test('the officer records the farmer\'s progress: successes, failures, field events, actions and observations', async () => {
    await openMenu(officerPage, 'Farmers');
    await officerPage.getByText(JOURNEY.farmer.name, { exact: true }).first().click();
    await officerPage.getByRole('button', { name: 'Progress' }).click();

    const form = officerPage.getByRole('form', { name: 'Record progress' });
    const entries = [
      { type: 'Success', title: 'Maize germination at 92% on the main plot' },
      { type: 'Failure', title: 'Bean seedlings damped off in the waterlogged corner', photo: true },
      { type: 'Field event', title: 'CAN top-dressing applied after the rain' },
      { type: 'Action taken', title: 'Dug a drainage furrow with the farmer' },
      { type: 'Observation', title: 'Fall armyworm frass on 2 of 20 plants scouted' },
    ];
    for (const entry of entries) {
      await form.getByLabel('Type').selectOption({ label: entry.type });
      await form.getByLabel('What happened *').fill(entry.title);
      if (entry.photo) await form.getByLabel('Photos (up to 4)').setInputFiles([pngPhoto('damping-off.png', [120, 90, 60])]);
      await form.getByRole('button', { name: 'Record progress' }).click();
      await expect(officerPage.getByRole('list', { name: 'Progress entries' }).getByText(entry.title)).toBeVisible();
    }

    const summary = officerPage.getByLabel('Progress summary');
    for (const label of ['Success: 1', 'Failure: 1', 'Field event: 1', 'Action taken: 1', 'Observation: 1']) {
      await expect(summary).toContainText(label);
    }
    const failure = officerPage.getByRole('listitem').filter({ hasText: 'damped off' });
    await expectImagesLoaded(failure.locator(PHOTOS));

    // The result of the advice, linked to the visit, counts towards the officer's advice efficacy.
    const officer = await apiAs(officerPage.request, SEEDED.officerNakuru);
    const visits = (await (await officer.get(`/api/v1/visits?farmerId=${JOURNEY.farmer.id}`)).json()) as { data: { visits: Array<{ id: string; status: string }> } };
    const completed = visits.data.visits.find(v => v.status === 'completed')!;
    const outcome = await officer.post('/api/v1/efficacy/outcomes', {
      visitId: completed.id,
      farmerId: JOURNEY.farmer.id,
      crop: 'maize',
      adviceCategory: 'nutrition',
      adviceSummary: 'CAN top-dressing at 50 kg/acre after rain',
      outcome: 'improved',
      officerNotes: 'New leaves green two weeks later.',
    });
    expect(outcome.status()).toBe(201);
  });

  test('the farmer sees the visits, the follow-up and the officer\'s messages', async () => {
    await farmerPage.reload();
    await openMenu(farmerPage, 'Visits');
    await expect(farmerPage.getByText(/Findings:.*Nitrogen deficiency/)).toBeVisible();
    await expect(farmerPage.getByText('Follow up', { exact: false }).first()).toBeVisible();

    await openMenu(farmerPage, MY_OFFICER_MENU);
    await expect(farmerPage.getByRole('group', { name: 'Officer message' }).filter({ hasText: 'top-dressing session' })).toBeVisible();

    // The farmer can read their progress log, but recording it is the officer's job.
    const farmer = await apiAs(farmerPage.request, JOURNEY.farmer.email);
    const progress = (await (await farmer.get(`/api/v1/farmers/${JOURNEY.farmer.id}/progress`)).json()) as { data: Array<{ kind: string }> };
    expect(progress.data.map(entry => entry.kind).sort()).toEqual(['action', 'failure', 'field_event', 'observation', 'success']);
    const write = await farmer.post(`/api/v1/farmers/${JOURNEY.farmer.id}/progress`, { kind: 'success', title: 'Self-reported', occurredOn: daysFromNow(0).date });
    expect(write.status()).toBe(403);
  });

  test('a message with a typo is corrected within the edit window', async () => {
    const officer = await apiAs(officerPage.request, SEEDED.officerNakuru);
    const conversations = (await (await officer.get('/api/v1/chatbot/conversations')).json()) as { data: Array<{ id: string; farmerId: string }> };
    const thread = conversations.data.find(c => c.farmerId === JOURNEY.farmer.id)!;
    const sent = (await (await officer.post('/api/v1/chatbot/messages', { conversationId: thread.id, content: 'Apply 500 kg/acre of CAN' })).json()) as { data: { id: string } };

    const edited = await officer.patch(`/api/v1/chatbot/messages/${sent.data.id}`, { content: 'Correction: apply 50 kg/acre of CAN' });
    expect(edited.status()).toBe(200);

    await farmerPage.reload();
    await openMenu(farmerPage, MY_OFFICER_MENU);
    await expect(farmerPage.getByText('Correction: apply 50 kg/acre of CAN')).toBeVisible();
    await expect(farmerPage.getByText('Apply 500 kg/acre of CAN')).toHaveCount(0);
  });
});
