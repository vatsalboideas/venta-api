import { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Venta ERP API",
    version: "1.0.0",
    description: "API docs for Brand CRUD and Log Analytics.",
  },
  servers: [{ url: "http://localhost:4000" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      UserIdHeader: {
        type: "apiKey",
        in: "header",
        name: "x-user-id",
      },
      UserRoleHeader: {
        type: "apiKey",
        in: "header",
        name: "x-user-role",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string" },
        },
      },
      AuthUser: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/Role" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          phone: { type: "string" },
          password: { type: "string", format: "password" },
          position: { type: "string" },
          department: { type: "string" },
          role: { $ref: "#/components/schemas/Role" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          requiresTwoFactor: { type: "boolean" },
          accessToken: { type: "string" },
          tempToken: { type: "string" },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      VerifyLogin2FARequest: {
        type: "object",
        required: ["tempToken", "token"],
        properties: {
          tempToken: { type: "string" },
          token: { type: "string", example: "123456" },
        },
      },
      TokenOnlyRequest: {
        type: "object",
        required: ["token"],
        properties: {
          token: { type: "string", example: "123456" },
        },
      },
      Role: {
        type: "string",
        enum: ["BOSS", "EMPLOYEE", "INTERN"],
      },
      Priority: {
        type: "string",
        enum: ["HIGH", "MEDIUM", "LOW"],
      },
      ForecastCategory: {
        type: "string",
        enum: ["PIPELINE", "COMMIT", "CLOSED"],
      },
      LogStatus: {
        type: "string",
        enum: ["COLD_LEAD", "MEET_PRESENT", "PROPOSAL_SENT", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"],
      },
      BrandOwner: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { $ref: "#/components/schemas/Role" },
        },
      },
      Brand: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          industry: { type: "string", nullable: true },
          priority: { $ref: "#/components/schemas/Priority" },
          forecastCategory: { $ref: "#/components/schemas/ForecastCategory" },
          expectedRevenue: { type: "string", example: "250000.00" },
          website: { type: "string", nullable: true },
          description: { type: "string", nullable: true },
          ownerId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          owner: { $ref: "#/components/schemas/BrandOwner" },
        },
      },
      CreateBrandRequest: {
        type: "object",
        required: ["name", "priority", "expectedRevenue"],
        properties: {
          name: { type: "string" },
          industry: { type: "string" },
          priority: { $ref: "#/components/schemas/Priority" },
          forecastCategory: { $ref: "#/components/schemas/ForecastCategory" },
          expectedRevenue: { type: "string", example: "250000.00" },
          website: { type: "string" },
          description: { type: "string" },
          ownerId: {
            type: "string",
            format: "uuid",
            description: "Only effective for BOSS role.",
          },
        },
      },
      UpdateBrandRequest: {
        type: "object",
        properties: {
          name: { type: "string" },
          industry: { type: "string" },
          priority: { $ref: "#/components/schemas/Priority" },
          forecastCategory: { $ref: "#/components/schemas/ForecastCategory" },
          expectedRevenue: { type: "string", example: "260000.00" },
          website: { type: "string" },
          description: { type: "string" },
          ownerId: {
            type: "string",
            format: "uuid",
            description: "Only effective for BOSS role.",
          },
        },
      },
      Contact: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          brandId: { type: "string", format: "uuid" },
          name: { type: "string" },
          position: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          phone: { type: "string", nullable: true },
          address: { type: "string", nullable: true },
          createdBy: { type: "string", format: "uuid" },
        },
      },
      CreateContactRequest: {
        type: "object",
        required: ["brandId", "name"],
        properties: {
          brandId: { type: "string", format: "uuid" },
          name: { type: "string" },
          position: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
        },
      },
      UpdateContactRequest: {
        type: "object",
        properties: {
          brandId: { type: "string", format: "uuid" },
          name: { type: "string" },
          position: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          createdBy: { type: "string", format: "uuid", description: "Only BOSS can reassign creator." },
        },
      },
      Log: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          brandId: { type: "string", format: "uuid" },
          contactId: { type: "string", format: "uuid", nullable: true },
          status: { $ref: "#/components/schemas/LogStatus" },
          priority: { $ref: "#/components/schemas/Priority" },
          assignedTo: { type: "string", format: "uuid" },
          lastContactDate: { type: "string", format: "date-time", nullable: true },
          followUpDate: { type: "string", format: "date-time", nullable: true },
          meetingDate: { type: "string", format: "date-time", nullable: true },
          actualRevenue: { type: "string", nullable: true },
          expectedRevenue: { type: "number", description: "Read-only, derived from Brand.expectedRevenue" },
          notes: { type: "string", nullable: true },
        },
      },
      CreateLogRequest: {
        type: "object",
        required: ["title", "brandId", "status", "priority"],
        properties: {
          title: { type: "string" },
          brandId: { type: "string", format: "uuid" },
          contactId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/LogStatus" },
          priority: { $ref: "#/components/schemas/Priority" },
          assignedTo: { type: "string", format: "uuid", description: "Only BOSS can set this; others become self-assigned." },
          lastContactDate: { type: "string", format: "date-time" },
          followUpDate: { type: "string", format: "date-time" },
          meetingDate: { type: "string", format: "date-time" },
          actualRevenue: { type: "string" },
          notes: { type: "string" },
        },
      },
      UpdateLogRequest: {
        type: "object",
        properties: {
          title: { type: "string" },
          brandId: { type: "string", format: "uuid" },
          contactId: { type: "string", format: "uuid", nullable: true },
          status: { $ref: "#/components/schemas/LogStatus" },
          priority: { $ref: "#/components/schemas/Priority" },
          assignedTo: { type: "string", format: "uuid", description: "Only BOSS can reassign logs." },
          lastContactDate: { type: "string", format: "date-time", nullable: true },
          followUpDate: { type: "string", format: "date-time", nullable: true },
          meetingDate: { type: "string", format: "date-time", nullable: true },
          actualRevenue: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
        },
      },
      RevenueTrendItem: {
        type: "object",
        properties: {
          bucket: { type: "string", format: "date-time" },
          revenue: { type: "number" },
        },
      },
      ConversionRateResponse: {
        type: "object",
        properties: {
          totalLogs: { type: "number" },
          closedWonLogs: { type: "number" },
          conversionRatePercent: { type: "number" },
        },
      },
      LeaderboardItem: {
        type: "object",
        properties: {
          userId: { type: "string", format: "uuid" },
          userName: { type: "string" },
          totalRevenue: { type: "number" },
          rank: { type: "number" },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }, { UserIdHeader: [], UserRoleHeader: [] }],
  paths: {
    "/auth/register": {
      post: {
        summary: "Register a user",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": { description: "User created" },
          "409": { description: "Email exists" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login with email/password",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login response or 2FA challenge",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/2fa/verify-login": {
      post: {
        summary: "Verify Google Authenticator during login",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VerifyLogin2FARequest" },
            },
          },
        },
        responses: {
          "200": { description: "JWT returned after 2FA verification" },
          "400": { description: "Invalid authenticator code" },
          "401": { description: "Invalid temp token" },
        },
      },
    },
    "/auth/me": {
      get: {
        summary: "Get current authenticated user profile",
        responses: {
          "200": { description: "Current user profile" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/auth/2fa/setup": {
      post: {
        summary: "Initialize Google Authenticator setup",
        responses: {
          "200": { description: "otpauth URL + QR code payload" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/auth/2fa/verify-setup": {
      post: {
        summary: "Verify setup code and enable 2FA",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TokenOnlyRequest" },
            },
          },
        },
        responses: {
          "200": { description: "2FA enabled" },
          "400": { description: "Invalid code or setup not initialized" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/auth/2fa/disable": {
      post: {
        summary: "Disable Google Authenticator for current user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/TokenOnlyRequest" },
            },
          },
        },
        responses: {
          "200": { description: "2FA disabled" },
          "400": { description: "Invalid code or 2FA not enabled" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/brands": {
      get: {
        summary: "List all brands",
        responses: {
          "200": {
            description: "Brands list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Brand" },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create brand",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBrandRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Brand created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Brand" },
              },
            },
          },
          "400": { description: "Validation error" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/brands/{id}": {
      get: {
        summary: "Get a brand by id",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": {
            description: "Brand details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Brand" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        summary: "Update a brand",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateBrandRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated brand",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Brand" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        summary: "Delete a brand",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "204": { description: "Deleted" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    },
    "/contacts": {
      get: {
        summary: "List all contacts",
        responses: { "200": { description: "Contacts list" }, "401": { description: "Unauthorized" } },
      },
      post: {
        summary: "Create contact (createdBy = current user)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateContactRequest" } } },
        },
        responses: { "201": { description: "Contact created" }, "401": { description: "Unauthorized" } },
      },
    },
    "/contacts/{id}": {
      get: {
        summary: "Get contact by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Contact details" }, "401": { description: "Unauthorized" }, "404": { description: "Not found" } },
      },
      patch: {
        summary: "Update contact (BOSS or creator)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateContactRequest" } } },
        },
        responses: { "200": { description: "Contact updated" }, "401": { description: "Unauthorized" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
      delete: {
        summary: "Delete contact (BOSS or creator)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "204": { description: "Deleted" }, "401": { description: "Unauthorized" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },
    "/logs": {
      get: {
        summary: "List all logs (includes read-only expectedRevenue)",
        responses: { "200": { description: "Logs list" }, "401": { description: "Unauthorized" } },
      },
      post: {
        summary: "Create log (BOSS or self-assigned)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateLogRequest" } } },
        },
        responses: { "201": { description: "Log created" }, "401": { description: "Unauthorized" } },
      },
    },
    "/logs/{id}": {
      get: {
        summary: "Get log by id",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Log details" }, "401": { description: "Unauthorized" }, "404": { description: "Not found" } },
      },
      patch: {
        summary: "Update log (BOSS or assigned user)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateLogRequest" } } },
        },
        responses: { "200": { description: "Log updated" }, "401": { description: "Unauthorized" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
      delete: {
        summary: "Delete log (BOSS or assigned user)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "204": { description: "Deleted" }, "401": { description: "Unauthorized" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } },
      },
    },
    "/analytics/logs/revenue-trend": {
      get: {
        summary: "Revenue trend over time",
        parameters: [
          {
            name: "period",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["day", "month"], default: "month" },
          },
        ],
        responses: {
          "200": {
            description: "Revenue trend",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RevenueTrendItem" },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/analytics/logs/conversion-rate": {
      get: {
        summary: "Closed won conversion rate",
        responses: {
          "200": {
            description: "Conversion rate payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ConversionRateResponse" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/analytics/logs/leaderboard": {
      get: {
        summary: "Revenue leaderboard by user",
        responses: {
          "200": {
            description: "Leaderboard entries",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/LeaderboardItem" },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
  },
};
