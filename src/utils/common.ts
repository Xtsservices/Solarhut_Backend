export const allFeatures =[
    "Dashboard",
    "My_Tasks",
    "Estimations",
    "Customers",
    "Masters",
    "Revenue",
    "Solar Capacities",
    "Expenditures",
    "Invoices"
];

// Sub-features mapping for features with dropdown sub-options
// Note: My_Tasks feature displays Leads and Jobs as tabs, not dropdown sub-features
export const subFeaturesMap = {
    "Masters": [
        { key: "masters", name: "Masters", display_order: 1 },
        { key: "locations", name: "Location", display_order: 2 },
        { key: "packages", name: "Packages", display_order: 3 },
        { key: "employees", name: "Employees", display_order: 4 },
        { key: "bank_details", name: "Bank Details", display_order: 5 },
        { key: "inventory", name: "Inventory", display_order: 6 },
        { key: "contacts", name: "Contacts", display_order: 7 }
    ],
    "Invoices": [
        { key: "invoices", name: "Invoices", display_order: 1 },
        { key: "tax_invoices", name: "Tax Invoices", display_order: 2 }
    ]
};

//AboutPage.jpg