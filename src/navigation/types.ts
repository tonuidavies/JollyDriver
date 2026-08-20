export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  DriverTabs: undefined;
  AdminTabs: undefined;
  /** Dispatch order detail (driver records collections / admin confirms) */
  DispatchDetail: { id: number; orderNumber?: string };
  /** Per-dispatch reconciliation report (items + matched payments) */
  DispatchReport: { id: number; orderNumber?: string };
  /** Route-level reconciliation (dispatched vs collected, shorts) */
  RouteRecon: { routeId: number; routeName?: string };
  // Management modules
  Vehicles: undefined;
  Agents: undefined;
  Dispatches: undefined;
  CreateDispatch: undefined;
  /** Direct-to-school delivery — no route, invoiced and completed in one call */
  SchoolDispatch: undefined;
  Customers: undefined;
  CustomerDetail: { id: number; name?: string };
  Invoices: undefined;
  /** Finance → shortages / overpayments over a range */
  Shortages: undefined;
  /** Agent commission rates + the earned-commission report */
  Commissions: undefined;
  /** Read-only GPS feed for tracked vehicles */
  LivePositions: undefined;
  Reports: undefined;
  ReportView: { kind: string; title: string };
};

export type DriverTabsParamList = {
  Home: undefined;
  Route: undefined;
  Collections: undefined;
  Profile: undefined;
};

export type AdminTabsParamList = {
  Home: undefined;
  Route: undefined;
  Collections: undefined;
  Profile: undefined;
};
