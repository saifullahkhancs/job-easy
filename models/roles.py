from enum import Enum

class UserRole(str, Enum):
    ADMIN = "admin"
    VISITOR = "visitor"
    CUSTOMER = "customer"