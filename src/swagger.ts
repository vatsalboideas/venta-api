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
  security: [{ UserIdHeader: [], UserRoleHeader: [] }],
  paths: {
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
