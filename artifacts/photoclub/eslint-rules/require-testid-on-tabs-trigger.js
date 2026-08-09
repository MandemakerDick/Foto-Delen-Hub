/**
 * Custom ESLint rule: every <TabsTrigger> element must have a data-testid prop.
 *
 * This is enforced specifically on manage.tsx so that any new tab added to the
 * Manage page is guaranteed to carry the testid that the smoke-test tab-count
 * assertion depends on.  The lint step runs before the test suite, so the gap
 * is caught at authoring time rather than only in CI.
 */

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Every <TabsTrigger> element must have a "data-testid" prop so the manage-i18n smoke test can count tabs reliably.',
      recommended: false,
    },
    schema: [],
    messages: {
      missingTestId:
        '<TabsTrigger> is missing a "data-testid" prop. Add one (e.g. data-testid="manage-tab-<name>") so the manage tab-count smoke test stays in sync.',
    },
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        // Match only <TabsTrigger …>
        const name = node.name;
        const componentName =
          name.type === "JSXIdentifier"
            ? name.name
            : name.type === "JSXMemberExpression"
            ? `${name.object.name}.${name.property.name}`
            : null;

        if (componentName !== "TabsTrigger") return;

        const hasTestId = node.attributes.some((attr) => {
          if (attr.type !== "JSXAttribute") return false; // spread — skip
          return (
            attr.name.type === "JSXNamespacedName"
              ? `${attr.name.namespace.name}:${attr.name.name.name}` === "data:testid"
              : attr.name.name === "data-testid"
          );
        });

        if (!hasTestId) {
          context.report({ node, messageId: "missingTestId" });
        }
      },
    };
  },
};

export default rule;
