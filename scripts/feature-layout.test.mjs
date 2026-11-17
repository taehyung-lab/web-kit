import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../packages/web-kit/tools/structure/config.mjs';

const config = { root: '/app', src: 'src', routes: 'src/routes', generated: [], generatedModels: [], support: [] };
const role = (file) => classify(config, `/app/src/features/orders/${file}`).layer;

test('feature root contains only index; UI and model files have their original safety roles', () => {
  assert.equal(role('index.ts'), 'public');
  assert.equal(role('messages.ts'), 'invalid');
  assert.equal(role('order.ts'), 'invalid');
  assert.equal(role('ui/messages.ts'), 'pages');
  assert.equal(role('ui/list/OrderListPage.tsx'), 'pages');
  assert.equal(role('model/list/use-order-list.ts'), 'hooks');
  assert.equal(role('model/list/order-list-search.ts'), 'search');
  assert.equal(role('model/order-store.ts'), 'storage');
  assert.equal(role('model/order-permissions.ts'), 'storage');
  assert.equal(role('model/form/order-form.ts'), 'data');
  assert.equal(role('model/order-policy.ts'), 'data');
  assert.equal(role('model/order.ts'), 'data');
  assert.equal(role('model/index.ts'), 'invalid');
  assert.equal(role('model/hooks/use-order.ts'), 'invalid');
});
